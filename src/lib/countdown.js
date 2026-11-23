import { addDays } from './dates'

const noon = (iso) => new Date(iso + 'T12:00:00')

// Whole days from today to a date (negative when it has passed)
export const daysUntil = (iso, today) => Math.round((noon(iso) - noon(today)) / 86400000)

export function inWords(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export const longDate = (iso, today) => noon(iso).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'long',
  ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
})

// The day Bob sends the check-in notification
export const checkInDay = (c) => addDays(c.on_date, -1)

// Time to check in: from the day before the trip until the trip, unless it's done or no reminder was wanted
export function checkInDue(c, today) {
  const d = daysUntil(c.on_date, today)
  return c.is_trip && !!c.checkin_at && !c.checked_in_at && (d === 0 || d === 1)
}

// The one countdown worth showing on Today: a check-in to do first, otherwise the nearest day
export function nextUp(items, today) {
  const ahead = items.filter((c) => c.on_date >= today)
  return ahead.find((c) => checkInDue(c, today)) ?? ahead[0] ?? null
}
