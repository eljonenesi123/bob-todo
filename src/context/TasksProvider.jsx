import { useEffect } from 'react'
import { useTasks } from '../hooks/useTasks'
import { startOutbox } from '../lib/outbox'
import { TasksContext } from './tasks'

export default function TasksProvider({ userId, children }) {
  useEffect(() => startOutbox(userId), [userId])
  const value = useTasks(userId)
  const left = value.todayTasks.filter((t) => !t.done).length

  // Red number on the Bob app icon = tasks left today
  useEffect(() => {
    if (value.loading || value.failed || !('setAppBadge' in navigator)) return
    const job = left > 0 ? navigator.setAppBadge(left) : navigator.clearAppBadge()
    job?.catch?.(() => {})
  }, [left, value.loading, value.failed])

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
