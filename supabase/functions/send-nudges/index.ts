// Bob: daily nudges. Runs every 5 minutes (pg_cron), decides who needs a push, sends it.
// Secrets needed (Edge Functions → Secrets):
//   SB_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SB_SECRET_KEY')!, {
  auth: { persistSession: false },
})
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const WINDOW = 120 // a nudge can go out up to 2h after its time (if the cron was late or the condition became true later)
const MAX_PER_DAY = 4 // scheduled nudges per day (task reminders, notes and rewards don't count)
const SLOTS = [
  { kind: 'midday', at: 13 * 60 },
  { kind: 'big3', at: 17 * 60 },
  { kind: 'streak', at: 20 * 60 },
  { kind: 'evening', at: 21 * 60 + 30 },
]
const RECAP_AT = 19 * 60 // Sundays

// Same list and order as the app (src/lib/quotes.js), so phone and app show the same quote
const QUOTES = [
  'Small steps still move you forward. Start with one.',
  'You don\u2019t have to do it all. Just the next thing.',
  'Done is better than perfect. Tick one off.',
  'Future you is already proud. Keep going.',
  'One task at a time is still a whole day of progress.',
  'Start messy. Finish anyway.',
  'Your pace is the right pace.',
  'Five focused minutes beat an hour of worrying.',
  'Hard things first, then the fun stuff tastes better.',
  'You\u2019ve handled every hard day so far. This one too.',
  'Progress loves a tiny start.',
  'Be the reason today goes well.',
  'Breathe, pick one, begin.',
  'Little wins add up to big days.',
  'Today counts, even the quiet parts.',
  'Make it easy for yourself: smallest step first.',
  'You\u2019re doing better than you think.',
  'Momentum starts with one checkmark.',
  'Focus on the next tick, not the whole list.',
  'Rest is part of the plan too.',
]
function quoteFor(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000)
  return QUOTES[dayOfYear % QUOTES.length]
}

type Task = { id: string; repeat: string; due_on: string | null; created_at: string; archived: boolean; is_big3: boolean; remind_at: string | null; title: string }
type Completion = { task_id: string; done_on: string }
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

// Every row of a query, 1000 at a time. Throws if a page fails: with half the data, finished tasks
// would look open and people would get nudges for nothing.
const PAGE = 1000
// deno-lint-ignore no-explicit-any
async function allRows<T>(makeQuery: () => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1)
    if (error) throw new Error(`load failed: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

// ---------- dates (same rules as the app) ----------
function local(tz: string, at = new Date()) {
  let parts: Record<string, string>
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(at).map((p) => [p.type, p.value]))
  } catch {
    return local('Europe/Tirane', at)
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: parts.weekday,
  }
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const inQuiet = (min: number, start: string, end: string) => {
  const s = toMin(start), e = toMin(end)
  return s <= e ? min >= s && min < e : min >= s || min < e
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const weekday = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay()
function isDueOn(task: Task, iso: string, doneEarlier: Set<string>) {
  if (task.archived) return false
  const start = task.due_on || task.created_at.slice(0, 10)
  if (iso < start) return false
  switch (task.repeat) {
    case 'daily': return true
    case 'weekdays': { const w = weekday(iso); return w >= 1 && w <= 5 }
    case 'weekly': return weekday(iso) === weekday(start)
    default: return start === iso || !doneEarlier.has(task.id)
  }
}
function day(tasks: Task[], comps: Completion[], iso: string) {
  const onceIds = new Set(tasks.filter((t) => t.repeat === 'once').map((t) => t.id))
  const doneEarlier = new Set(comps.filter((c) => c.done_on < iso && onceIds.has(c.task_id)).map((c) => c.task_id))
  const doneThatDay = new Set(comps.filter((c) => c.done_on === iso).map((c) => c.task_id))
  const due = tasks.filter((t) => isDueOn(t, iso, doneEarlier))
  return { due, doneIds: doneThatDay, done: due.filter((t) => doneThatDay.has(t.id)).length }
}
function streak(tasks: Task[], comps: Completion[], today: string) {
  const full = (s: ReturnType<typeof day>) => s.due.length > 0 && s.done === s.due.length
  let n = full(day(tasks, comps, today)) ? 1 : 0
  let d = addDays(today, -1)
  for (let i = 0; i < 60; i++) {
    const s = day(tasks, comps, d)
    if (s.due.length > 0) { if (full(s)) n++; else break }
    d = addDays(d, -1)
  }
  return n
}

// ---------- calendar (startOf and occurrences are the same as the app's, src/lib/calendar.js) ----------
type Entry = {
  id: string; user_id: string; title: string; starts_on: string; ends_on: string; at_time: string | null
  repeat: string; every: number; until: string | null; skipped: string[]
  remind_days: number[]; remind_at: string; remind_from: string
}
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000)
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const onDay = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
function startOf(e: Entry, k: number): string | null {
  if (e.repeat === 'weeks') return addDays(e.starts_on, 7 * e.every * k)
  if (e.repeat === 'never') return k === 0 ? e.starts_on : null
  const [y0, m0, d0] = e.starts_on.split('-').map(Number)
  const months = m0 - 1 + (e.repeat === 'year' ? 12 * k : k)
  const y = y0 + Math.floor(months / 12)
  const m = (months % 12) + 1
  if (e.repeat !== 'month_weekday') return onDay(y, m, Math.min(d0, daysIn(y, m)))
  const first = 1 + ((weekday(e.starts_on) - weekday(onDay(y, m, 1)) + 7) % 7)
  let d = first + 7 * (Math.ceil(d0 / 7) - 1)
  if (d > daysIn(y, m)) d -= 7
  return onDay(y, m, d)
}
// The starts between two days
function starts(e: Entry, from: string, to: string) {
  const found: string[] = []
  for (let k = 0; ; k++) {
    const s = startOf(e, k)
    if (!s || s > to || (e.until && s > e.until)) return found
    if (s >= from && !e.skipped.includes(s)) found.push(s)
  }
}
// The reminder to send now for one start: the latest whose time has come, if any.
// Times that had already gone by when the entry was saved don't count.
function dueReminder(e: Entry, start: string, now: { date: string; minutes: number }, saved: { date: string; minutes: number }) {
  const at = toMin(e.remind_at)
  // Too late to be useful: the appointment has begun
  if (start === now.date && e.at_time && now.minutes >= toMin(e.at_time)) return null
  const due = e.remind_days.filter((n) => {
    const d = addDays(start, -n)
    const come = d < now.date || (d === now.date && now.minutes >= at)
    const fresh = d > saved.date || (d === saved.date && at > saved.minutes)
    return come && fresh
  })
  return due.length ? Math.min(...due) : null
}
const inWords = (n: number) => n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === 7 ? 'in a week' : `in ${n} days`
const niceDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' })
function calendarMessage(e: Entry, start: string, today: string, from: string) {
  const end = addDays(start, daysBetween(e.starts_on, e.ends_on))
  const when = inWords(daysBetween(today, start))
  const dates = start === end ? `${niceDate(start)}${e.at_time ? ` at ${e.at_time.slice(0, 5)}` : ''}` : `${niceDate(start)} to ${niceDate(end)}`
  return { title: `${e.title} ${start === end ? 'is' : 'starts'} ${when}`, body: `${dates}.${from ? ` Shared by ${from}.` : ''}` }
}

// ---------- messages ----------
const pick = (style: string, v: { gentle: string; sweet_hype: string; tough_love: string }) =>
  (v as Record<string, string>)[style] ?? v.gentle
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function message(kind: string, ctx: { name: string; style: string; total: number; done: number; left: number; bigLeft: number; streak: number }) {
  const { name, style, total, done, left, bigLeft } = ctx
  const hi = name ? `, ${name}` : ''
  switch (kind) {
    case 'midday':
      if (total === 0 || done >= total / 2) return null
      return {
        title: 'Halfway check 💪',
        body: pick(style, {
          gentle: `${done} of ${total} done. One more before lunch ends?`,
          sweet_hype: `${done} of ${total} done, you're warming up! One more?`,
          tough_love: `${done} of ${total}. Half the day is gone. Pick one and finish it.`,
        }),
      }
    case 'big3':
      if (bigLeft === 0) return null
      return { title: 'Your Big three are waiting ⭐', body: `${plural(bigLeft, 'Big three task')} still open. You've got time.` }
    case 'streak':
      if (ctx.streak < 3 || done > 0 || total === 0) return null
      return { title: 'Keep your streak alive 🔥', body: `${ctx.streak} days in a row. One task keeps it going.` }
    case 'evening':
      if (left === 0) return null
      return {
        title: 'How did today go? 🌙',
        body: pick(style, {
          gentle: `${plural(left, 'task')} left, and that's okay. Finish one or leave it for tomorrow.`,
          sweet_hype: `${plural(left, 'task')} left! Squeeze in one more win before bed?`,
          tough_love: `${plural(left, 'task')} left. Ten minutes now beats carrying it to tomorrow.`,
        }),
      }
  }
  return null
}

// ---------- sending ----------
// Returns how many devices accepted the push (0 = nobody got it).
// ttl: how long (seconds) the push service keeps trying when the phone is off
async function sendToAll(subs: Sub[], payload: Record<string, unknown>, ttl = 3600) {
  const results: number[] = await Promise.all(subs.map(async (s): Promise<number> => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: ttl },
      )
      return 1
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push failed', code, (e as { body?: string }).body)
      return 0
    }
  }))
  return results.reduce((a, b) => a + b, 0)
}

// Returns true only the first time (kind, ref) is logged for that user and day → no duplicates
async function once(userId: string, kind: string, ref: string, date: string) {
  const { error } = await db.from('nudge_log').insert({ user_id: userId, kind, ref, sent_on: date })
  return !error
}

// deno-lint-ignore no-explicit-any
type Profile = any

async function handleUser(p: Profile, subs: Sub[], names: Map<string, string>, sent: string[], partners: Profile[], byUser: Map<string, Sub[]>) {
  const now = local(p.timezone || 'Europe/Tirane')

  const since = addDays(now.date, -60)
  const [t, recent, older] = await Promise.all([
    allRows<Task>(() => db.from('tasks').select('*').eq('user_id', p.id).eq('archived', false).order('id')),
    allRows<Completion>(() => db.from('task_completions').select('task_id, done_on').eq('user_id', p.id).gte('done_on', since).order('done_on').order('task_id')),
    // One-off tasks finished before that must stay finished (same rule as the app)
    allRows<Completion>(() => db.from('task_completions').select('task_id, done_on, tasks!inner(repeat)').eq('user_id', p.id)
      .eq('tasks.repeat', 'once').eq('tasks.archived', false).lt('done_on', since).order('done_on').order('task_id')),
  ])
  const c = [...older, ...recent]
  const today = day(t, c, now.date)
  const total = today.due.length
  const done = today.done
  const left = total - done
  const bigLeft = today.due.filter((x) => x.is_big3 && !today.doneIds.has(x.id)).length
  const st = streak(t, c, now.date)
  const name = (p.display_name && !p.display_name.includes('@')) ? p.display_name : ''
  const push = async (payload: Record<string, unknown>, label: string, ttl?: number) => {
    const delivered = await sendToAll(subs, { badge: left, url: './', ...payload }, ttl)
    sent.push(`${p.id.slice(0, 6)}:${label}${delivered ? '' : ':failed'}`)
    return delivered
  }

  // 0. This person finished their list → tell their partner, only if they turned sharing on
  //    (the partner's own quiet hours apply)
  if (p.share_day_done && total > 0 && left === 0) {
    for (const a of partners) {
      const aSubs = byUser.get(a.id) ?? []
      if (a.id === p.id || !aSubs.length) continue
      const aNow = local(a.timezone || 'Europe/Tirane')
      if (inQuiet(aNow.minutes, a.quiet_start ?? '22:30', a.quiet_end ?? '08:00')) continue
      if (await once(a.id, 'partner_day_done', p.id, now.date)) {
        const who = name || 'Your person'
        const n = await sendToAll(aSubs, { title: `🎉 ${who} finished today's list`, body: `${total} of ${total} done. Maybe leave a letter?`, tag: `done-${p.id}`, url: './' })
        sent.push(`${a.id.slice(0, 6)}:partner_day_done${n ? '' : ':failed'}`)
      }
    }
  }

  if (!subs.length) return // this person has no phone connected: nothing else to send
  const quiet = (min: number) => inQuiet(min, p.quiet_start ?? '22:30', p.quiet_end ?? '08:00')

  // Online check-in, the day before a trip, at the time picked for that trip.
  // Goes out even when snoozed or when the day is done, and inside quiet hours only if such a time was picked.
  // If it couldn't be delivered the day before (phone off), it still goes out on the day of the trip.
  const { data: trips, error: tripErr } = await db.from('countdowns').select('id, title, on_date, checkin_at')
    .or(`user_id.eq.${p.id},shared_with.eq.${p.id}`).eq('is_trip', true).not('checkin_at', 'is', null)
    .is('checked_in_at', null).in('on_date', [now.date, addDays(now.date, 1)])
  if (tripErr) console.error('countdowns', tripErr.message) // e.g. SQL 07 not run yet: everything else still works
  for (const trip of trips ?? []) {
    const at = toMin(trip.checkin_at)
    const isToday = trip.on_date === now.date
    if (!isToday && now.minutes < at) continue
    if (quiet(now.minutes) && (isToday || !quiet(at))) continue
    if (!await once(p.id, 'checkin', trip.id, trip.on_date)) continue
    const ok = await push({
      title: `✈️ ${trip.title} is ${isToday ? 'today' : 'tomorrow'}`,
      body: 'Time to do your online check-in.',
      tag: `checkin-${trip.id}`,
    }, 'checkin', 12 * 3600)
    // Nobody got it: forget we tried, so the next run tries again
    if (!ok) await db.from('nudge_log').delete().match({ user_id: p.id, kind: 'checkin', ref: trip.id, sent_on: trip.on_date })
  }

  // Calendar reminders, picked by this person (or by the partner, for both). Same rules as the check-in:
  // not stopped by a snooze or a finished day, and inside quiet hours only if such a time was picked.
  // If it couldn't be delivered it's tried again until the first day is over, with the right words by then.
  const { data: entries, error: calErr } = await db.from('calendar_entries').select('*')
    .or(`user_id.eq.${p.id},and(shared_with.eq.${p.id},remind_partner.eq.true)`).neq('remind_days', '{}')
  if (calErr) console.error('calendar', calErr.message) // e.g. SQL 11 not run yet: everything else still works
  for (const e of (entries ?? []) as Entry[]) {
    const saved = local(p.timezone || 'Europe/Tirane', new Date(e.remind_from))
    for (const start of starts(e, now.date, addDays(now.date, 7))) {
      const n = dueReminder(e, start, now, saved)
      if (n === null) continue
      const pickedQuiet = addDays(start, -n) === now.date && quiet(toMin(e.remind_at))
      if (quiet(now.minutes) && !pickedQuiet) continue
      const ref = `${e.id}:${n}`
      if (!await once(p.id, 'calendar', ref, start)) continue
      const from = e.user_id === p.id ? '' : names.get(e.user_id) || 'your person'
      const ok = await push({ ...calendarMessage(e, start, now.date, from.includes('@') ? 'your person' : from), tag: `calendar-${e.id}` }, 'calendar', 12 * 3600)
      if (!ok) await db.from('nudge_log').delete().match({ user_id: p.id, kind: 'calendar', ref, sent_on: start })
    }
  }

  if (quiet(now.minutes)) return

  // 1. Surprise letters whose time has come, and replies (even when snoozed)
  const { data: notes } = await db.from('notes').select('id, author_id, kind')
    .eq('recipient_id', p.id).in('kind', ['surprise', 'reply']).is('notified_at', null).is('opened_at', null)
    .lte('deliver_at', new Date().toISOString())
  for (const n of notes ?? []) {
    const from = names.get(n.author_id) || 'someone special'
    const ok = await push(n.kind === 'reply'
      ? { title: `💌 ${from} replied to your letter`, body: 'Open Bob to read it.', tag: `note-${n.id}` }
      : { title: '💌 Bob has a message for you', body: `From ${from}. Open Bob to read it.`, tag: `note-${n.id}` }, n.kind)
    // Only mark it sent when a device really accepted it; otherwise retry on the next run
    const { error } = await db.from('notes').update(ok
      ? { notified_at: new Date().toISOString(), notify_error: null }
      : { notify_error: 'Her phone didn’t accept the notification' }).eq('id', n.id)
    // notify_error comes with SQL 05; without it, still mark a sent note so it isn't sent again
    if (error && ok) await db.from('notes').update({ notified_at: new Date().toISOString() }).eq('id', n.id)
  }

  // 2. Rewards that just unlocked
  const { data: rewards } = await db.from('rewards').select('id, title, streak_required')
    .eq('recipient_id', p.id).is('notified_at', null).is('claimed_at', null).lte('streak_required', st)
  for (const r of rewards ?? []) {
    const ok = await push({ title: '🎁 Reward unlocked!', body: `${st}-day streak: "${r.title}" is ready to claim.`, tag: `reward-${r.id}` }, 'reward')
    if (ok) await db.from('rewards').update({ notified_at: new Date().toISOString() }).eq('id', r.id)
  }

  if (p.snoozed_on === now.date) return

  // 3. Quote of the day at their chosen time, with a glance at today's list
  const qAt = toMin(p.quote_time ?? '08:00')
  if (now.minutes >= qAt && now.minutes < qAt + WINDOW && await once(p.id, 'quote', '', now.date)) {
    const plan = total === 0 ? 'Nothing on the list yet.' : `${plural(total, 'task')} on today\u2019s list.`
    await push({ title: name ? `Good morning, ${name}` : 'Good morning', body: `\u201C${quoteFor(now.date)}\u201D ${plan}`, tag: 'quote' }, 'quote')
  }

  // 4. Weekly recap, Sunday evening
  if (now.weekday === 'Sun' && now.minutes >= RECAP_AT && now.minutes < RECAP_AT + WINDOW) {
    const count = c.filter((x) => x.done_on > addDays(now.date, -7)).length
    if (count > 0 && await once(p.id, 'recap', '', now.date)) {
      await push({ title: 'Your week with Bob 📊', body: `${plural(count, 'task')} done this week${st ? ` and a ${st}-day streak` : ''}. Proud of you.`, tag: 'recap' }, 'recap')
    }
  }

  if (total > 0 && left === 0) return // day complete: no more nudging

  // 5. Task reminders at the time she picked
  for (const task of today.due) {
    if (!task.remind_at || today.doneIds.has(task.id)) continue
    const at = toMin(task.remind_at)
    if (now.minutes >= at && now.minutes < at + WINDOW && await once(p.id, 'reminder', task.id, now.date)) {
      await push({ title: `⏰ ${task.title}`, body: 'Your reminder is here. You can do this.', tag: `task-${task.id}` }, 'reminder')
    }
  }

  // 6. Scheduled nudges, capped per day
  const { count: used } = await db.from('nudge_log').select('id', { count: 'exact', head: true })
    .eq('user_id', p.id).eq('sent_on', now.date).in('kind', SLOTS.map((s) => s.kind))
  let budget = MAX_PER_DAY - (used ?? 0)
  for (const slot of SLOTS) {
    if (budget <= 0) break
    if (now.minutes < slot.at || now.minutes >= slot.at + WINDOW) continue
    const msg = message(slot.kind, { name, style: p.nudge_style, total, done, left, bigLeft, streak: st })
    if (msg && await once(p.id, slot.kind, '', now.date)) {
      await push({ ...msg, tag: slot.kind }, slot.kind)
      budget--
    }
  }
}

// A stray rejected promise (e.g. inside a push library) must never end the whole run:
// the Edge Runtime stops the worker on one, which shows up as WORKER_ERROR.
globalThis.addEventListener('unhandledrejection', (e) => {
  console.error('unhandled rejection', (e as PromiseRejectionEvent).reason)
  e.preventDefault()
})

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    return await run(req)
  } catch (e) {
    // Readable in SQL: select content from net._http_response order by id desc limit 1
    console.error('run failed', e)
    return Response.json({ ok: false, error: String((e as Error)?.stack || e).slice(0, 500) }, { status: 500 })
  }
})

async function run(req: Request) {
  const body = await req.json().catch(() => ({}))

  const [{ data: profiles, error: pErr }, { data: subs, error: sErr }] = await Promise.all([
    db.from('profiles').select('*'),
    db.from('push_subscriptions').select('*'),
  ])
  if (pErr || sErr) console.error('load failed', pErr?.message || sErr?.message)
  const byUser = new Map<string, Sub[]>()
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]))
  const sent: string[] = []

  // Manual test: {"test": true} sends a hello to every subscribed device
  if (body?.test) {
    for (const [userId, list] of byUser) {
      await sendToAll(list, { title: 'Bob says hi ☀️', body: 'Notifications are working!', tag: 'test', url: './' })
      sent.push(`${userId.slice(0, 6)}:test`)
    }
    return Response.json({ ok: true, sent })
  }

  for (const p of profiles ?? []) {
    // Everyone gets the same treatment. Each person is checked even without a device,
    // so the "finished today's list" push to the partner still works.
    try {
      await handleUser(p, byUser.get(p.id) ?? [], names, sent, profiles ?? [], byUser)
    } catch (e) {
      console.error('user failed', p.id, e)
    }
  }
  return Response.json({ ok: true, sent })
}
