import { useEffect } from 'react'
import { useTasks } from '../hooks/useTasks'
import { TasksContext } from './tasks'

export default function TasksProvider({ children }) {
  const value = useTasks()
  const left = value.todayTasks.filter((t) => !t.done).length

  // Red number on the Bob app icon = tasks left today
  useEffect(() => {
    if (value.loading || !('setAppBadge' in navigator)) return
    const job = left > 0 ? navigator.setAppBadge(left) : navigator.clearAppBadge()
    job?.catch?.(() => {})
  }, [left, value.loading])

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
