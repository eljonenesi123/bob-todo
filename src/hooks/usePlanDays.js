import { useMemo } from 'react'
import { useTaskData } from '../context/tasks'
import { addDays } from '../lib/dates'

const PLAN_AHEAD = 5

// Today and the next 5 days, with how much is planned on each
export function usePlanDays() {
  const { today, planFor } = useTaskData()
  return useMemo(() => Array.from({ length: PLAN_AHEAD + 1 }, (_, i) => {
    const iso = addDays(today, i)
    const d = new Date(iso + 'T12:00:00')
    const list = planFor(iso)
    return {
      iso,
      isToday: i === 0,
      dow: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      num: d.getDate(),
      label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      count: i === 0 ? list.filter((t) => !t.done).length : list.length,
    }
  }), [today, planFor])
}
