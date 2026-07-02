// content.ts

let startTime = Date.now();
const website = window.location.hostname;

console.log(`CodeTrack Pro: Tracking activity on ${website}`);

const flushActivity = () => {
  const endTime = Date.now();
  const duration = Math.floor((endTime - startTime) / 1000); // duration in seconds
  startTime = endTime;
  
  if (duration > 0) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'ACTIVITY_LOG',
          data: {
            website,
            duration,
            activity_date: new Date().toISOString()
          }
        });
      } catch (e) {
        console.log("CodeTrack Pro: Extension context invalidated.");
      }
    }
  }
};

// Flush periodically because Manifest V3 service workers cannot rely on unload alone.
window.setInterval(flushActivity, 60_000);
window.addEventListener('pagehide', flushActivity);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushActivity();
  else startTime = Date.now();
});

// Auto-detect finished LeetCode tasks
let lastSolvedSlug = "";

const checkLeetCodeSubmission = () => {
  if (!window.location.hostname.includes("leetcode.com") || !window.location.pathname.includes("/problems/")) {
    return;
  }

  // Get current slug
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const idx = pathParts.indexOf('problems');
  const currentSlug = idx !== -1 && pathParts[idx + 1] ? pathParts[idx + 1] : "";
  if (!currentSlug || currentSlug === lastSolvedSlug) {
    return;
  }

  // Look for green "Accepted" text, filtering out SVGs/icons in parent tags
  const successBadge = Array.from(document.querySelectorAll("span, div, p, font, a")).find(el => {
    const text = el.childNodes.length > 0 
      ? Array.from(el.childNodes)
          .filter(node => node.nodeType === 3) // Node.TEXT_NODE
          .map(node => node.textContent?.trim())
          .join("")
      : el.textContent?.trim();
    return text === "Accepted";
  });

  if (successBadge) {
    let problemNumber = "";
    // LeetCode's title selector
    const titleEl = document.querySelector('div[data-cy="question-title"]') || document.querySelector('div[class*="text-title-large"]');
    const titleText = titleEl?.textContent || document.title || "";
    const match = titleText.match(/^(\d+)\s*\./) || document.title.match(/^(\d+)\s*\./);
    
    problemNumber = match ? match[1] : "";
    const normalizedTitle = titleText
      .replace(/^\d+\s*[.·-]\s*/, "")
      .replace(/\s*[-|]\s*LeetCode.*$/i, "")
      .trim() || currentSlug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    const difficultyElement = Array.from(document.querySelectorAll("div, span")).find((element) => {
      const text = element.textContent?.trim();
      return (text === "Easy" || text === "Medium" || text === "Hard")
        && (element.className.toString().includes("difficulty") || element.parentElement?.textContent?.trim() === text);
    });
    const difficulty = difficultyElement?.textContent?.trim() || "Unknown";
    console.log(`CodeTrack Pro: Solved LeetCode problem #${problemNumber} (${currentSlug})`);
    lastSolvedSlug = currentSlug;
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'LEETCODE_SOLVED',
          problemNumber: problemNumber,
          title: normalizedTitle,
          slug: currentSlug,
          difficulty,
          solvedAt: new Date().toISOString(),
          url: window.location.href
        });
      } catch (e) {
        console.log("CodeTrack Pro: Extension context invalidated. Please refresh the page.");
      }
    }
  }
};

if (window.location.hostname.includes("leetcode.com")) {
  const observer = new MutationObserver(() => {
    checkLeetCodeSubmission();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
