import { supabase } from '@/lib/supabase'

chrome.runtime.onInstalled.addListener(() => {
  console.log("CodeTrack Pro Extension Installed");
});

// Helper to extract numbers from text
const extractNumbers = (text: string): string[] => {
  return text.match(/\d+/g) || [];
};

// Helper to extract LeetCode slug from URL
const extractSlug = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('problems');
    return idx !== -1 && parts[idx + 1] ? parts[idx + 1].toLowerCase() : "";
  } catch (e) {
    return "";
  }
};

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  if (message.type === 'ACTIVITY_LOG') {
    chrome.storage.local.get('student', async (result: any) => {
      const student = result.student;
      if (!student?.id || !student?.password) {
        sendResponse({ status: 'no_session' });
        return;
      }

      const { error } = await supabase.rpc('record_student_activity', {
        p_student_id: student.id,
        p_password: student.password,
        p_website: message.data.website,
        p_duration: message.data.duration,
        p_activity_at: message.data.activity_date
      });

      if (error) {
        console.error('CodeTrack Pro: Activity save failed:', error.message);
        sendResponse({ status: 'error', message: error.message });
      } else {
        sendResponse({ status: 'success' });
      }
    });
  } else if (message.type === 'LEETCODE_SOLVED') {
    const solvedNum = message.problemNumber;
    const url = message.url;
    console.log(`CodeTrack Pro Background: Problem #${solvedNum} solved at ${url}, checking pending student tasks...`);

    chrome.storage.local.get('student', async (result: any) => {
      const student = result.student;
      if (!student || !student.id || !student.password) {
        console.log("CodeTrack Pro Background: No logged in student session found.");
        sendResponse({ status: 'no_session' });
        return;
      }

      try {
        // Persist the unique solved problem first. The database deduplicates by student + slug.
        const { error: recordError } = await supabase.rpc('record_leetcode_solve', {
          p_student_id: student.id,
          p_password: student.password,
          p_problem_number: message.problemNumber || '',
          p_title: message.title || message.slug,
          p_slug: message.slug || extractSlug(url),
          p_problem_url: url,
          p_difficulty: message.difficulty || 'Unknown',
          p_solved_at: message.solvedAt || new Date().toISOString()
        });
        if (recordError) throw recordError;

        // 1. Fetch pending tasks for the student
        const { data: tasks, error: fetchErr } = await supabase.rpc('get_student_tasks', {
          p_student_id: student.id,
          p_password: student.password
        });

        if (fetchErr) throw fetchErr;

        // 2. Find any pending task matching the solved number or URL slug
        const matchingTask = (tasks ?? []).find((task: any) => {
          if (task.status !== 'pending') return false;

          // Try to match by URL slug if the task is formatted as a LeetCode URL
          const solvedSlug = extractSlug(url);
          if (solvedSlug && task.title.includes('leetcode.com/problems/')) {
            const taskSlug = extractSlug(task.title);
            if (taskSlug && taskSlug === solvedSlug) return true;
          }

          // Fallback to number matching
          const titleNums = extractNumbers(task.title);
          const descNums = extractNumbers(task.description || "");
          return titleNums.includes(solvedNum) || descNums.includes(solvedNum);
        });

        if (matchingTask) {
          console.log(`CodeTrack Pro Background: Found matching pending task "${matchingTask.title}" (ID: ${matchingTask.task_id}). Auto-submitting...`);
          
          // 3. Submit the task automatically (auto-approved)
          const { error: submitErr } = await supabase.rpc('auto_submit_leetcode_task', {
            p_student_id: student.id,
            p_password: student.password,
            p_task_id: matchingTask.task_id,
            p_proof_url: url
          });

          if (submitErr) {
            console.error("CodeTrack Pro Background: Auto-submission failed:", submitErr.message);
          } else {
            console.log(`CodeTrack Pro Background: Task "${matchingTask.title}" successfully auto-submitted!`);
            
            // Show system notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'assets/icon.png', // Fallback, chrome extensions will look for this or default
              title: 'Task Auto-Submitted!',
              message: `Your solved problem LeetCode #${solvedNum} matches "${matchingTask.title}". It has been submitted to your staff portal.`,
              priority: 2
            });
          }
        } else {
          console.log(`CodeTrack Pro Background: No pending task requires LeetCode #${solvedNum}.`);
        }
      } catch (err) {
        console.error("CodeTrack Pro Background: Error checking/submitting task:", err);
      }
    });

    sendResponse({ status: 'processing' });
  }
  return true;
});
