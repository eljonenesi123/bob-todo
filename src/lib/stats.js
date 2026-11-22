import { addDays, isDueOn } from './dates'

// How many tasks were due on a day, and how many of those were done
export function dayStatus(tasks, completions, iso) {
  const onceIds = new Set(tasks.filter((t) => t.repeat === 'once').map((t) => t.id))
  const doneEarlier = new Set(
    completions.filter((c) => c.done_on < iso && onceIds.has(c.task_id)).map((c) => c.task_id)
  )
  const doneThatDay = new Set(completions.filter((c) => c.done_on === iso).map((c) => c.task_id))
  const due = tasks.filter((t) => isDueOn(t, iso, doneEarlier))
  return { due: due.length, done: due.filter((t) => doneThatDay.has(t.id)).length }
}

const complete = (s) => s.due > 0 && s.done === s.due

// Days in a row where everything was done. Days with nothing planned don't break it.
// Today only counts once it's complete, so an unfinished today doesn't reset the streak.
export function currentStreak(tasks, completions, today) {
  let streak = complete(dayStatus(tasks, completions, today)) ? 1 : 0
  let d = addDays(today, -1)
  for (let i = 0; i < 60; i++) {
    const s = dayStatus(tasks, completions, d)
    if (s.due > 0) {
      if (complete(s)) streak++
      else break
    }
    d = addDays(d, -1)
  }
  return streak
}

export function bestStreak(tasks, completions, today) {
  let best = 0
  let run = 0
  for (let i = 59; i >= 0; i--) {
    const s = dayStatus(tasks, completions, addDays(today, -i))
    if (s.due === 0) continue
    run = complete(s) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

const weekdayMon0 = (iso) => (new Date(iso + 'T12:00:00').getDay() + 6) % 7 // Mon = 0

// Monday → Sunday of the current week
export function weekBars(tasks, completions, today) {
  const monday = addDays(today, -weekdayMon0(today))
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const iso = addDays(monday, i)
    if (iso > today) return { label, iso, pct: null, isToday: false }
    const s = dayStatus(tasks, completions, iso)
    return { label, iso, pct: s.due ? Math.round((s.done / s.due) * 100) : 0, isToday: iso === today, full: complete(s) }
  })
}

// Calendar cells for the current month (Mon-first), each with a status
export function monthGrid(tasks, completions, today) {
  const first = today.slice(0, 8) + '01'
  const cells = Array.from({ length: weekdayMon0(first) }, (_, i) => ({ key: 'pad' + i, status: 'pad' }))
  for (let d = first; d.slice(0, 7) === today.slice(0, 7); d = addDays(d, 1)) {
    let status = 'future'
    if (d <= today) {
      const s = dayStatus(tasks, completions, d)
      status = s.due === 0 ? 'empty' : complete(s) ? 'full' : s.done > 0 ? 'partial' : 'missed'
    }
    cells.push({ key: d, day: Number(d.slice(8)), status, isToday: d === today })
  }
  return cells
}

export function doneLast7Days(completions, today) {
  const from = addDays(today, -6)
  return completions.filter((c) => c.done_on >= from && c.done_on <= today).length
}
