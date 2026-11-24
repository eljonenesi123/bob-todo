import { addDays } from './dates'
import { daysUntil } from './countdown'

// When calendar entries happen. startOf and occurrences are the same in the Edge Function (send-nudges).

const pad = (n) => String(n).padStart(2, '0')
const parts = (iso) => iso.split('-').map(Number)
const weekdayOf = (iso) => new Date(iso + 'T12:00:00').getDay()
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m = 1 to 12
const onDay = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// The k-th start (0 = the first), always counted from the first one so nothing drifts
export function startOf(e, k) {
  if (e.repeat === 'weeks') return addDays(e.starts_on, 7 * e.every * k)
  if (e.repeat === 'never') return k === 0 ? e.starts_on : null
  const [y0, m0, d0] = parts(e.starts_on)
  const months = m0 - 1 + (e.repeat === 'year' ? 12 * k : k)
  const y = y0 + Math.floor(months / 12)
  const m = (months % 12) + 1
  if (e.repeat !== 'month_weekday') return onDay(y, m, Math.min(d0, daysIn(y, m))) // the 31st is the last day of shorter months
  const first = 1 + ((weekdayOf(e.starts_on) - weekdayOf(onDay(y, m, 1)) + 7) % 7)
  let d = first + 7 * (Math.ceil(d0 / 7) - 1)
  if (d > daysIn(y, m)) d -= 7 // the fifth Monday is the last one when there are only four
  return onDay(y, m, d)
}

// Every time an entry touches the days from `from` to `to`
export function occurrences(e, from, to) {
  const length = daysUntil(e.ends_on, e.starts_on)
  const found = []
  for (let k = 0; ; k++) {
    const start = startOf(e, k)
    if (!start || start > to || (e.until && start > e.until)) return found
    const end = addDays(start, length)
    if (end >= from && !e.skipped.includes(start)) found.push({ entry: e, start, end })
  }
}

const byStart = (a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.entry.title.localeCompare(b.entry.title)

// Entries and countdowns together, as { entry, start, end } or { entry, start, end, countdown: true }
export function between(entries, countdowns, from, to) {
  return [
    ...entries.flatMap((e) => occurrences(e, from, to)),
    ...countdowns.filter((c) => c.on_date >= from && c.on_date <= to)
      .map((c) => ({ entry: c, start: c.on_date, end: c.on_date, countdown: true })),
  ].sort(byStart)
}

// The next starts from a day on, for "Starts …, then …"
export function nextStarts(e, from, count) {
  const found = []
  for (let k = 0; k < 2000 && found.length < count; k++) {
    const start = startOf(e, k)
    if (!start || (e.until && start > e.until)) break
    if (start >= from && !e.skipped.includes(start)) found.push(start)
  }
  return found
}

// The shortest time from one start to the next: an entry must not run into its own next one
export function longest(e) {
  return { never: 367, weeks: 7 * e.every, month_date: 28, month_weekday: 28, year: 365 }[e.repeat]
}

export const monthOf = (iso) => iso.slice(0, 8) + '01'
export function addMonths(first, n) {
  const [y, m] = parts(first)
  const months = y * 12 + m - 1 + n
  return onDay(Math.floor(months / 12), (months % 12) + 1, 1)
}

// The Mondays of the weeks a month touches
export function weeksOf(first) {
  const [y, m] = parts(first)
  const last = onDay(y, m, daysIn(y, m))
  const weeks = []
  for (let d = addDays(first, -((weekdayOf(first) + 6) % 7)); d <= last; d = addDays(d, 7)) weeks.push(d)
  return weeks
}

// Which line of a week each bar lies on. What doesn't fit is counted per day.
export function layoutWeek(monday, list, lines) {
  const sunday = addDays(monday, 6)
  const taken = Array.from({ length: lines }, () => Array(7).fill(false))
  const bars = []
  const more = Array(7).fill(0)
  for (const o of list) {
    if (o.start > sunday || o.end < monday) continue
    const a = Math.max(0, daysUntil(o.start, monday))
    const z = Math.min(6, daysUntil(o.end, monday))
    const line = taken.findIndex((days) => !days.slice(a, z + 1).includes(true))
    if (line < 0) {
      for (let i = a; i <= z; i++) more[i]++
      continue
    }
    taken[line].fill(true, a, z + 1)
    bars.push({ ...o, a, z, line, before: o.start < monday, after: o.end > sunday })
  }
  return { bars, more }
}

const ORDER = ['first', 'second', 'third', 'fourth', 'last']
export const weekdayInMonth = (iso) =>
  `${ORDER[Math.ceil(parts(iso)[2] / 7) - 1]} ${new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}`
export function dayInMonth(iso) {
  const d = parts(iso)[2]
  const end = d > 10 && d < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] ?? 'th'
  return `${d}${end}`
}

// "Mon 4 January"; with the year only when it could be mistaken
export const dayText = (iso, today) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'long', ...(Math.abs(daysUntil(iso, today)) < 300 ? {} : { year: 'numeric' }),
}).replace(',', '')

export const spanText = ({ start, end }, today) => (start === end ? dayText(start, today) : `${dayText(start, today)} to ${dayText(end, today)}`)

// What to say about one occurrence on a day it touches
export function onDayText({ entry, start, end, countdown }, day, today) {
  if (countdown) return 'In Countdowns'
  if (start !== end) return `Day ${daysUntil(day, start) + 1} of ${daysUntil(end, start) + 1}, until ${dayText(end, today)}`
  return entry.at_time ? `At ${entry.at_time.slice(0, 5)}` : 'All day'
}
