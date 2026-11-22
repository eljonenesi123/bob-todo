// All dates are local (her phone's timezone), as YYYY-MM-DD strings.
export function toISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

const weekday = (iso) => new Date(iso + 'T12:00:00').getDay()

// Is this task on the list for the given day?
// `doneEarlier` = ids of one-off tasks already completed before that day.
export function isDueOn(task, iso, doneEarlier) {
  if (task.archived) return false
  const start = task.due_on || task.created_at.slice(0, 10)
  if (iso < start) return false
  switch (task.repeat) {
    case 'daily': return true
    case 'weekdays': { const w = weekday(iso); return w >= 1 && w <= 5 }
    case 'weekly': return weekday(iso) === weekday(start)
    default: return start === iso || !doneEarlier.has(task.id) // unfinished one-offs carry over
  }
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function prettyDate(d = new Date()) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
