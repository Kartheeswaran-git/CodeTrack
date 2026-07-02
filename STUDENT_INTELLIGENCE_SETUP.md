# Student intelligence deployment

The feature code is complete in the dashboard, extension, database migration, and sync Edge Function. Use this checklist when deploying it to Supabase.

## 1. Apply the database migration

Apply `supabase/migrations/20260702000000_student_intelligence.sql` through the normal migration pipeline before deploying either frontend.

The migration creates:

- unique LeetCode solved-problem history;
- GitHub and LeetCode daily activity used by the heatmaps;
- a normalized student activity timeline;
- staff notifications and per-staff preferences;
- platform synchronization status;
- staff-scoped detail RPCs and extension capture RPCs;
- task/submission event triggers and inactivity-alert generation.

## 2. Deploy the synchronization function

Deploy `sync-coding-activity` and configure these Edge Function secrets:

```text
SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
GITHUB_SYNC_TOKEN=<GitHub token with read access to the required contribution data>
SYNC_CRON_SECRET=<long random secret>
```

The function is protected by `x-cron-secret` or the service-role bearer token. Never place these secrets in either frontend.

## 3. Schedule synchronization

Invoke the function on a backend scheduler every 6–12 hours:

```http
POST https://<project-ref>.supabase.co/functions/v1/sync-coding-activity
x-cron-secret: <SYNC_CRON_SECRET>
```

Each run refreshes public GitHub/LeetCode data, records sync state, emits milestone and sync-failure alerts, and checks for students inactive for seven days.

## 4. Release the extension

Build and reload the extension after applying the migration. The extension now:

- sends active website time once per minute and when a tracked tab is hidden;
- records each accepted LeetCode problem exactly once;
- updates LeetCode daily activity and difficulty totals;
- connects solved problems with matching assigned tasks;
- continues to auto-submit matching tasks.

## 5. Verification checklist

- Sign in as staff and open **Students**.
- Select a department student and verify `/staff/students/:studentId` loads.
- Solve one LeetCode problem while signed into the extension.
- Confirm the problem, LeetCode heatmap square, activity event, and staff notification appear.
- Assign and submit a task, then verify the task history and notification link.
- Run `sync-coding-activity` once and confirm both platform “last synced” labels update.
- Confirm a staff account cannot open a student outside its department or explicit assignment.

## Security follow-up

The new APIs enforce staff-to-student authorization, but the legacy project still stores custom staff/student passwords and passes them to RPCs. Move those accounts to Supabase Auth sessions and remove passwords from browser storage before a production launch.
