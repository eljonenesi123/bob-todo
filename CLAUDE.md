# Bob: project guide for Claude Code

Read this whole file before changing anything. It is the single source of truth for how Bob works, how it is deployed, and how Eljon likes to work.

---

## 1. What Bob is

Bob is a personal to-do app that Eljon (the developer) built for his girlfriend. It is a **PWA** (installable web app) used on **her iPhone** (added to the Home Screen from Safari) and **her PC** (Chrome/Edge). Only two accounts exist and sign-ups are meant to be closed.

Core idea: a calm daily planner that **nudges her with push notifications** only when tasks are still open, shows a **daily quote**, tracks **streaks**, and lets Eljon leave **love notes and rewards** that unlock when she finishes her day.

- Live app: https://eljonenesi123.github.io/bob-todo/
- Repo: https://github.com/eljonenesi123/bob-todo (public, branch `main`)
- Local path (Windows): `C:\Users\user\bob-todo`
- Supabase project ref: `wsxfxhwhwplarmvmtsdj` (region Europe, free tier)
- Design mockups (Claude Design canvas, may be outdated vs. the new look): https://claude.ai/artifact/KuZFjdRBmFsNgZeiCs9ePG

Accounts (since 2026-11-22 both have **the same features**):
- Each person has their own tasks (RLS), streak, rewards and notifications.
- The **Letters** tab (called Notes until 2026-11-23; code and table still say `notes`) has two sides for both: **For you** (letters and rewards received, reply to a letter) and **Write to <name>** (send letters and rewards to the other).
- The **Notebook** tab has **Notes** (groups like "Gift ideas" with notes inside, private unless the group is shared) and **Countdowns** (trips and other days). Notes are stored as plain text: whoever can open the Supabase project can read them (see §9, PIN lock).
- Each can turn on "Tell <name> when I finish my day".
- `profiles.role` ('admin' for Eljon) no longer changes anything in the app; it's only kept in the data. Copy uses the other person's display name, never "she/her".

---

## 2. How Eljon likes to work (follow this)

- **Step by step**, hands-on. He reviews live results and reports bugs with screenshots. Explain what to click in plain words.
- **Mobile-first** always. Design for iPhone width first (390px), desktop is secondary (`max-width: 480px` centered column).
- Prefer **snippets/diffs** over resending whole files, unless a file is badly broken.
- He is on **Windows, VS Code, PowerShell 5**: **`&&` does not work.** Use `;` or separate lines:
  `git add . ; git commit -m "message" ; git push`
- He deploys by pushing to `main` (GitHub Actions builds and publishes automatically).
- Local preview: `npm run dev` → http://localhost:5173/bob-todo/ (Vite dev server, not Live Server, for this project).
- Run `npm run lint` before saying a change is done. Keep it at zero errors.
- Never put secrets in code, commits or chat. `.env.local` is git-ignored.
- When a change needs SQL, put it in a new numbered file in `supabase/sql/` (`05_...sql`) and tell him to run it in the Supabase **SQL Editor**.
- When the Edge Function changes, he must redeploy it by pasting the file into **Supabase → Edge Functions → send-nudges → Code → Deploy** (no Supabase CLI set up). After any redeploy, check **Verify JWT** is still **off**.

---

## 3. Tech stack

| Part | Tech |
|---|---|
| Frontend | React 19 + Vite 8, plain CSS files per screen (no Tailwind, no UI kit) |
| Animation | `framer-motion` |
| Backend | Supabase: Postgres + Auth + Realtime + Edge Functions + pg_cron + pg_net |
| Auth | Email **6-digit OTP code** (`signInWithOtp` + `verifyOtp({ type: 'email' })`), no passwords |
| Email sending | Custom SMTP via **Gmail** (`studioscriptline@gmail.com`, app password) |
| PWA | `vite-plugin-pwa` with `strategies: 'injectManifest'`, custom `src/sw.js` (Workbox precache + push handlers) |
| Push | Web Push (VAPID). Edge Function `send-nudges` uses `npm:web-push@3.6.7` |
| Hosting | GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`), `base: '/bob-todo/'` |

### Environment variables
`.env.local` (local only, git-ignored) and **GitHub repo secrets** (Settings → Secrets and variables → Actions) must both contain:
- `VITE_SUPABASE_URL` = `https://wsxfxhwhwplarmvmtsdj.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the `sb_publishable_...` key
- `VITE_VAPID_PUBLIC_KEY` = VAPID public key (starts with `BL2ZCe...`, 87 chars)

**Supabase Edge Function secrets** (Edge Functions → Secrets):
- `SB_SECRET_KEY` (the `sb_secret_...` key, used to bypass RLS server-side)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:studioscriptline@gmail.com`)
- `CRON_SECRET` (random string; the cron job sends it in the `x-cron-secret` header)

---

## 4. File map

```
index.html                 Fonts (Bricolage Grotesque + Newsreader), iOS PWA meta tags
vite.config.js             base '/bob-todo/', VitePWA manifest (name Bob, theme #2B2D31, icons)
.github/workflows/deploy.yml  Build with secrets → deploy to Pages on push to main
public/icons/*, apple-touch-icon.png, favicon.svg   Sun-on-yellow app icons
src/main.jsx               React root
src/App.jsx                Session gate: Welcome (signed out) → Setup (first run) → TasksProvider + Shell
                           Splash (src/components/Splash.*) on top for ≥1.6s: Tally mark draws itself + quote of the day
src/Shell.jsx              Tabs (today/notebook/notes/nudges; progress opens from the button on Today), Letters switch (For you / Write to <name>), BottomNav,
                           Day-complete overlay, syncPush(); passes partner + names down
src/sw.js                  Service worker: precache, offline navigation, 'push' + 'notificationclick', app badge
src/index.css              Global tokens (colors, fonts), .screen/.btn/.field basics
src/Shell.css              Bottom nav, shared .page-title/.panel/.tab-screen, paper-page kit (.paper-page/.desk-head/.pad-line/.ink-btn)

src/context/tasks.js           TasksContext + useTaskData()
src/context/TasksProvider.jsx  Wraps useTasks(); sets app icon badge = tasks left today
src/hooks/useTasks.js      Fetch tasks/completions/subtasks, realtime sync, todayTasks, planFor(iso),
                           toggle, addTask (with steps + due_on), updateTask, moveToTomorrow, reorder (positions),
                           removeTask (archive) / restoreTask, addStep, toggleStep, removeStep / restoreStep (the Undo bar)
src/hooks/useProfile.js    Own profile, update(); auto-saves browser timezone
src/hooks/useNotes.js      Letters (received and written) and rewards; openNote, claimReward, sendReply, repliesTo, answers, author names
src/hooks/useNotebook.js   Groups and the notes inside, realtime; saveGroup, removeGroup, saveNote (notices edits from another device), removeNote
src/hooks/useCountdowns.js Countdowns and trips, realtime; add, update, remove
src/hooks/usePartner.js    The other account (id, display_name) + cleanName()

src/lib/supabase.js        createClient(URL, PUBLISHABLE_KEY)
src/lib/dates.js           toISO (local YYYY-MM-DD), addDays, isDueOn (repeat rules + carry-over), greeting, prettyDate
src/lib/photo.js           Letter photos: shrinkPhoto (1600px JPEG, drops location data), sendLetter (photo first, then the letter), photoUrl, deletePhoto
src/lib/rows.js            allRows(): fetch every row, 1000 at a time (Supabase's limit per request)
src/lib/countdown.js       daysUntil, inWords, checkInDue, nextUp (the one line on Today)
src/lib/stats.js           dayStatus, currentStreak, bestStreak, weekBars, monthGrid, doneLast7Days
src/lib/quotes.js          20 original quotes; quoteOfTheDay() by day-of-year (SAME list as the Edge Function)
src/lib/categories.js      CATEGORIES + REPEATS
src/lib/pwa.js             isStandalone, isIOS, notificationsSupported, install prompt, setup-done flag
src/lib/push.js            enablePush / disablePush / syncPush / deviceStatus. "On" means saved in push_subscriptions for
                           this account, not just allowed; a subscription owned by another account is replaced
src/lib/focus.js           Focus timer session in localStorage (survives closing the app)

src/screens/Welcome.*      Email → 6-digit code sign-in ("Sign in or create your account")
src/screens/Setup.*        First-run: Add to Home Screen (iOS steps / desktop install) + allow notifications
src/screens/Today.*        Planner page: "Good evening, <name>" at the top, date masthead, tally, day strip (today + 5), legal-pad list, Big three, steps
src/screens/Progress.*     Streak numeral + tally marks, week bars, pen-marked month calendar, next reward
src/screens/Notebook.*     List of groups + Notes/Countdowns switch
src/screens/Group.jsx       One open group: all its notes readable, copy button, Edit group
src/screens/Countdowns.jsx Countdown list, "Done" for a check-in
src/screens/Notes.*        "For you" (Letters tab): surprises and replies, locked count, rewards (claim), opened letters
src/screens/NotesAdmin.jsx "Write to <name>": notes (after a finished day / surprise at a time), rewards, real delivery status
src/screens/Nudges.*       Notifications switch (checks the database) + errors, snooze, "Tell Eljon when I finish my day",
                           nudge style, times, name, sign out (no explainer texts: kept uncluttered on purpose)

src/components/TaskRow.jsx     Ruled row: margin checkbox, pen strike, Big three highlighter, steps panel (+ Edit / Focus buttons),
                               swipe-left delete, hold (or right-click) to edit, drag the dots to reorder
src/components/AddTaskSheet.jsx Paper bottom sheet for new AND edit (editing prop): title, When, Big three, Repeat, Steps (new only),
                               Remind at, Category; edit adds Move to tomorrow + Delete
src/components/FocusTimer.*     Full-screen focus timer (10/25/45 min, pause, five more, mark done)
src/components/DayStrip.jsx     Today + next 5 days with task-count dots
src/components/DayComplete.*    Full-screen celebration + sealed note to open
src/components/UndoBar.*        "Deleted …" with Undo, 8 seconds, shown by Shell (onNotice from Today)
src/components/PhotoPicker.jsx, LetterPhoto.jsx  Pick one photo for a letter / show it in an open letter
src/components/LetterReply.jsx  Reply box under an open letter (Letters and Day complete)
src/components/NextUp.*         One line on Today: nearest countdown, or the check-in to do
src/components/CountdownSheet.jsx Paper sheet to add/edit a countdown or trip
src/components/GroupSheet.jsx, NoteSheet.jsx  Add/edit a group (name, share) or a note (name, text; autocorrect off for passwords)
src/components/PaperSheet.jsx, CheckRow.jsx, BackButton.jsx  Shared pieces for sheets and pages that open from a button
src/components/BottomNav.jsx    4 tabs, yellow dot on Letters for new surprises, on Nudges when this phone couldn't connect

supabase/functions/send-nudges/index.ts  The nudge engine (see §7)
supabase/sql/01..09_*.sql                Schema history (what still has to be run: see §9)
```

---

## 5. Database (Supabase Postgres)

All tables have **RLS on**. Users only see their own rows unless stated.

- **profiles**: `id` (= auth user), `display_name`, `role` ('user'|'admin'), `timezone`, `quiet_start` (22:30), `quiet_end` (08:00), `nudge_style` ('gentle'|'sweet_hype'|'tough_love'), `snoozed_on` (date), `quote_time` (08:00), `share_day_done` (bool, her opt-in). Created by trigger `handle_new_user` on sign-up.
  - Users may only UPDATE these columns: display_name, timezone, quiet_start, quiet_end, nudge_style, snoozed_on, quote_time, share_day_done (column grants, so nobody can make themselves admin).
  - Both accounts can read each other's profile ("partners read profiles", SQL 06: any signed-in user, fine while sign-ups are closed).
- **tasks**: `title`, `category`, `is_big3`, `repeat` ('once'|'daily'|'weekdays'|'weekly'), `remind_at` (time), `due_on` (date: the day it's planned for / start date), `archived` (soft delete), `position` (list order).
- **task_completions**: `(task_id, done_on)` primary key. One row per task per day done. Streaks/history come from this.
- **subtasks** ("steps"): `task_id`, `title`, `done_at` (persistent, not per day), `position`.
- **notes** (letters): `author_id`, `recipient_id`, `body`, `kind` ('day_complete'|'surprise'|'reply'), `reply_to` (the letter it answers), `photo_path` (its photo in the private storage bucket `letter-photos`, `<author id>/<uuid>.jpg`; readable by the author and by whoever can read the letter; `body` may be empty then), `deliver_at`, `notified_at` (set only after a device accepted the push), `notify_error` (last failed try), `opened_at`. Recipient can only update `opened_at` and only sees surprises once `deliver_at <= now()`.
- **rewards**: `title`, `streak_required`, `notified_at`, `claimed_at`. Recipient can only update `claimed_at`.
- **push_subscriptions**: one row per device (`endpoint` unique, `p256dh`, `auth`). `push_device_count(person)` (security definer) tells either of you how many devices a person has (count only).
- **nudge_log**: `(user_id, kind, ref, sent_on)` unique. Server-only (RLS on, no policies). Prevents duplicate pushes.
- **notebook_pages** = groups: `title`, `shared_with` (`kind`, `body`, `pinned` are left over from the first version and unused). **notebook_items** = notes in a group: `title`, `body`, `updated_at` (trigger: moves only when title/body change; the app saves with `.eq('updated_at', …)` so it never overwrites a newer version). `done_at`/`position` unused.
- **countdowns**: `title`, `on_date`, `is_trip`, `checkin_at` (time of day, the day before; null = no reminder), `checked_in_at`, `shared_with`.
- Groups and countdowns are seen and edited by `user_id` and `shared_with`; only the owner can delete or stop sharing. New tables need explicit GRANTs (see SQL 07).
- Realtime publication includes: tasks, task_completions, subtasks, notebook_pages, notebook_items, countdowns.
- Cron: job `bob-nudges` runs every 5 minutes → `net.http_post` to the Edge Function with header `x-cron-secret`.

### Task rules (keep app and Edge Function identical)
- Dates are **local** `YYYY-MM-DD` strings (`toISO`), never UTC dates. The client always sends `due_on`/`done_on` explicitly.
- `isDueOn(task, day, doneEarlier)`:
  - not before `due_on`
  - daily: every day; weekdays: Mon to Fri; weekly: same weekday as `due_on`
  - once: on `due_on`, and **carries over** every following day until completed (UI shows "from Monday")
- Future days (`planFor`) show one-offs with `due_on === day` plus repeating tasks; tasks can't be completed on future days, but steps can be ticked early.
- Steps: ticking the last open step completes the task for today; unticking a step reopens it.
- Completions are loaded for the last 60 days (streaks, Progress) **plus every older completion of a one-off task**; without those, old finished one-offs carry over onto today again (fixed 2026-11-23, in the app and the Edge Function).
- Streak: consecutive fully-done days; days with nothing planned neither count nor break it; today only counts once complete.

---

## 6. Auth & email gotchas (learned the hard way)

- **Use the 6-digit code, never magic links.** On iPhone a Home-Screen app has separate storage from Safari, so links would sign her into Safari, not Bob.
- Email templates **"Magic link or OTP"** and **"Confirm signup"** both use `{{ .Token }}` (new users get "Confirm signup"!). Editing templates requires custom SMTP.
- Auth → URL Configuration: Site URL `https://eljonenesi123.github.io/bob-todo/`, redirect URLs include that `/**` and `http://localhost:5173/**`.
- Gmail SMTP needs 2-Step Verification + an **app password** (16 chars).
- "Allow new users to sign up" should be **off** once both accounts exist.

---

## 7. Notifications (Edge Function `send-nudges`)

Runs every 5 min. For every profile, in their local timezone:

- **Someone finished today's list** and their `share_day_done` is on: one push to the other person's devices ("🎉 Ana finished today's list"), respecting the receiver's quiet hours, once per day. Works even if the finisher's own phone isn't connected.
- Everything below goes to each person about their own day and needs that person to have a device; without one nothing is sent (and notes stay unsent, not falsely marked).
- **Online check-in**: the day before a trip, from the trip's `checkin_at` on, once per person and trip date (`nudge_log` kind `checkin`), to the owner and `shared_with`, unless checked in. Ignores snooze and a finished day; waits for quiet hours to end unless the picked time is inside them; if it couldn't be delivered it retries, also on the day of the trip.
0. Skip during quiet hours (it fires when they end, within a 2h window).
1. **Surprise letters and replies** whose `deliver_at` has passed (ignore snooze) → "Bob has a message for you". `notified_at` is set only if a device accepted it; otherwise `notify_error` is set and it retries next run. A note she opens in the app first is never pushed.
2. **Rewards** just unlocked by the streak → "Reward unlocked!"
3. Stop here if `snoozed_on = today`.
4. **Quote of the day** at `quote_time` (default 08:00): quote + "N tasks on today's list".
5. **Weekly recap** Sundays 19:00.
6. Stop if the day is complete.
7. **Task reminders** at each task's `remind_at` (if not done).
8. **Scheduled nudges**, max 4/day, each only if its condition holds: midday 13:00 (< half done), big3 17:00 (Big three open), streak 20:00 (streak ≥ 3 and nothing done), evening 21:30 (tasks left). Wording varies by `nudge_style`.

Each push payload: `{ title, body, tag, url: './', badge: <tasks left> }`. `sw.js` shows it and sets the app badge. Dead subscriptions (404/410) are deleted.

**Testing** (SQL Editor; replace the secret, never commit it):
```sql
select net.http_post(
  url := 'https://wsxfxhwhwplarmvmtsdj.supabase.co/functions/v1/send-nudges',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
  body := '{"test": true}'::jsonb);
-- then:
select id, status_code, content::text from net._http_response order by id desc limit 3;
```
A test reply is `{ ok, sent }` (the old `debug` block was removed).

**"Did she get my note?"** One row that answers most questions:
```sql
select now() as now_utc,
  (select count(*) from push_subscriptions s where s.user_id = n.recipient_id) as her_devices,
  n.deliver_at, n.notified_at, n.notify_error, n.opened_at,
  (select status || ' at ' || start_time from cron.job_run_details d join cron.job j on j.jobid = d.jobid
     where j.jobname = 'bob-nudges' order by start_time desc limit 1) as last_cron_run,
  (select status_code || ' ' || left(content::text, 80) from net._http_response order by id desc limit 1) as last_function_reply
from notes n order by created_at desc limit 1;
```
Troubleshooting map: `her_devices = 0` → her phone isn't connected: Bob → Nudges → switch off and on (2026-11-22: her phone's old subscription belonged to another account and the save failed silently; the app now replaces it automatically). 401 `UNAUTHORIZED_NO_AUTH_HEADER` → Verify JWT is on. `Invalid API key` → `SB_SECRET_KEY` wrong (copy the real key with the copy button, not the masked text). `notified_at` set but nothing on the lock screen → iPhone Settings → Notifications → Bob (Lock Screen, Immediate delivery, no Focus). iOS updates the PWA only on the second launch after a deploy.

---

## 8. Design system (important: "must not look AI-generated")

**Concept: graphite desk, silver paper, yellow highlighter.** A planner/legal pad, not a SaaS dashboard.

- Colors (user's palette): graphite `#2B2D31` (desk/background, dominant), silver `#D9DADC` (paper and text on desk, dominant), yellow `#FFC93C` (**only** for things needing attention: highlighter on Big three, the add pen, tally marks, nav marker, switches). Ink on paper = `#2B2D31`, pencil (secondary text on paper) = `#55585E`, rules = `#C3C5C9`, margin line = `#B4B6BB`. Tokens live in `src/index.css`.
- Type: **Bricolage Grotesque** for interface (use width/opsz axes for the big date numeral), **Newsreader italic** only for quotes and Eljon's notes (feels handwritten).
- Today page: huge date numeral masthead, tally bar, day strip whose selected day becomes a paper tab joined to the pad, ruled legal-pad list with a margin line; checkboxes sit in the margin and draw their tick; done = pen strike-through; Big three = yellow highlighter swipe (the one page-load animation).
- **Avoid** (generic AI tells): ALL-CAPS eyebrow labels, middle-dot meta strings ("A · B"), emoji in the UI (fine in push titles), identical rounded cards everywhere, fade-and-slide-up on every section, gradient washes, `→` on buttons, generic fonts (Inter, Plus Jakarta), lorem/filler copy.
- Copy: plain, warm, sentence case, active verbs ("Add to today", "Write a task"). Errors say what happened and how to fix it.
- Accessibility floor: real buttons/inputs, `aria` on icon buttons, 44px touch targets, focus ring (yellow), `prefers-reduced-motion` respected, text contrast ≥ 4.5:1.
- Every screen uses the paper page pattern (Today, Progress, Notes, Notes for her, Nudges, Welcome, Setup, Day complete, Focus): a short heading on the desk, then a `.pad` of ruled `.pad-line`s with a 52px margin column. The pad kit (.pad, .pad-h, .ruled, .row-margin, .box, .hl, .pill, .line-input, .switch, .btn-ink) lives in `Today.css`; the page-level pieces live in `Shell.css`.
- Generic paper helpers (.pad-block, .field-label, .field-hint, .ink-btn, .pad-line) live in `Shell.css`; envelope and letter styles live in `Notes.css` and are reused by Day complete.

---

## 9. Status & next steps

Done: sign-in (code), PWA + offline + install, Today with steps/5-day planning/carry-over, Progress, Notes (+ admin), Day complete, Nudges settings, push engine with quote/reminders/nudges/notes/rewards/recap, app badge, live sync between devices.

Must verify after the last commit (`5400f36 Steps, 5-day planning, daily quote, new look`):
- [x] `supabase/sql/04_subtasks_and_quote.sql` was run (checked 2026-11-22: `subtasks` table and `profiles.quote_time` both answer over the REST API)
- [ ] Edge Function redeployed with the quote version (+ Verify JWT off)
  - [x] Verify JWT is off (checked 2026-11-22: a call with no auth gets the function's own plain `Unauthorized`, not `UNAUTHORIZED_NO_AUTH_HEADER`)
  - [ ] Quote version is the deployed code: in Supabase → Edge Functions → send-nudges → Code, search for `quoteFor`. If it's missing, paste `supabase/functions/send-nudges/index.ts` and Deploy.
- [x] New look is live (checked 2026-11-22: the Pages bundle contains the Today page strings)
- [ ] New look reviewed on iPhone + PC; fix visual bugs from screenshots (needs Eljon on the real devices)

Notebook, countdowns, replies (2026-11-23):
- [x] `07_notebook_countdowns_replies.sql` was run (Eljon: the check answered 3), Edge Function deployed (Supabase said success), pushed and live (63d5a7d)
- [ ] A no-auth POST to the function says `Unauthorized`
- [ ] Tested on the iPhone: check-in push, reply to a letter

Notebook as groups, Progress as a button (2026-11-23). To ship it, in this order:
- [x] Run `supabase/sql/08_notebook_groups.sql` (the last line must answer 0) BEFORE pushing (Eljon confirmed)
- [x] Push to main (no Edge Function change)

Undo after delete and photos in letters (2026-11-23). To ship it, in this order:
- [x] Run `supabase/sql/09_letter_photos.sql` (the last line must answer 1; Eljon confirmed)
- [x] Push to main (no Edge Function change)
- [ ] Test on the iPhone: swipe a task away and Undo; send a letter with a photo from the camera roll

Batch of 2026-11-22 (honest Nudges switch, delivery status, quote fix, cleanup, all screens restyled, edit task, move to tomorrow, reorder, focus timer, "she finished her day"). To ship it, in this order:
- [ ] Run `supabase/sql/05_order_sharing_delivery.sql` in the SQL Editor
- [ ] Redeploy the Edge Function (paste `supabase/functions/send-nudges/index.ts`, Deploy, check Verify JWT is still off)
- [ ] Push to main
- [ ] Test on her iPhone: hold a task to edit, drag the dots, Focus on a task, Nudges switch, "Tell Eljon" switch

Equal features (2026-11-22, after the batch above):
- [ ] Run `supabase/sql/06_equal_partners.sql`
- [ ] Redeploy the Edge Function again (day-done push now goes to the partner, whoever finished)
- [ ] Eljon turns on Nudges on his own phone (Bob → Nudges → switch) so he gets notifications too

Backlog (ask Eljon to prioritise; her feedback decides):
- PIN lock for a group, encrypted on the device before it reaches Supabase (so passwords aren't readable in the database). Decide this before real passwords go in.
- Someday list; plan further than 5 days; return flight on a trip (ideas of 2026-11-23)
- Nightly 1-tap mood check-in
- Albanian/English language switch (Eljon builds multilingual sites: EN/SQ/DE)
- Keyboard way to reorder tasks (drag is pointer-only today)
- Focus timer can't notify when it ends while Bob is closed (iOS web apps can't schedule local notifications)

## 10. Definition of done for any change
1. Works at 390px wide first, then desktop.
2. `npm run lint` passes.
3. Any SQL is in a new numbered file with plain run instructions; any Edge Function change comes with redeploy instructions.
   Before handing over an Edge Function change, run it with Deno, not just a syntax check: `deno check` a copy of
   `index.ts` (outside the repo, with `{ "nodeModulesDir": "none" }`), then start it with fake env vars and confirm a call
   without the secret returns 401 `Unauthorized`. (2026-11-23: a stray line passed esbuild but crashed the function on
   every run, so no notifications went out overnight. After any redeploy, a no-auth POST must say `Unauthorized`, not
   `WORKER_ERROR`.)
4. Tell Eljon exactly what to test, and give the push command in PowerShell-safe form.
