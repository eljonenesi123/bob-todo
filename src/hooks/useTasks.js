import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISO, addDays, isDueOn } from '../lib/dates'

async function fetchAll() {
  const now = toISO()
  const [t, c] = await Promise.all([
    supabase.from('tasks').select('*').eq('archived', false).order('created_at'),
    supabase.from('task_completions').select('task_id, done_on').gte('done_on', addDays(now, -60)),
  ])
  return { t, c, now }
}

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState(toISO())

  const apply = useCallback(({ t, c, now }) => {
    if (!t.error) setTasks(t.data)
    if (!c.error) setCompletions(c.data)
    setToday(now)
    setLoading(false)
  }, [])

  // Used by event handlers (realtime, focus, failed writes)
  const load = useCallback(async () => apply(await fetchAll()), [apply])

  useEffect(() => {
    let active = true
    fetchAll().then((res) => { if (active) apply(res) })
    // Live sync between her phone and PC
    const channel = supabase
      .channel('bob-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, load)
      .subscribe()
    // Refresh when she comes back to the app (also handles midnight rollover)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [apply, load])

  const todayTasks = useMemo(() => {
    const onceIds = new Set(tasks.filter((t) => t.repeat === 'once').map((t) => t.id))
    const doneEarlier = new Set(
      completions.filter((c) => c.done_on < today && onceIds.has(c.task_id)).map((c) => c.task_id)
    )
    const doneToday = new Set(completions.filter((c) => c.done_on === today).map((c) => c.task_id))
    return tasks
      .filter((t) => isDueOn(t, today, doneEarlier))
      .map((t) => ({ ...t, done: doneToday.has(t.id) }))
  }, [tasks, completions, today])

  const toggle = useCallback(async (task) => {
    if (task.done) {
      setCompletions((cs) => cs.filter((c) => !(c.task_id === task.id && c.done_on === today)))
      const { error } = await supabase.from('task_completions').delete()
        .eq('task_id', task.id).eq('done_on', today)
      if (error) load()
    } else {
      setCompletions((cs) => [...cs, { task_id: task.id, done_on: today }])
      const { error } = await supabase.from('task_completions').insert({ task_id: task.id, done_on: today })
      if (error) load()
    }
  }, [today, load])

  const addTask = useCallback(async (fields) => {
    const { data, error } = await supabase.from('tasks')
      .insert({ ...fields, due_on: toISO() }).select().single()
    if (error) throw error
    setTasks((ts) => (ts.some((t) => t.id === data.id) ? ts : [...ts, data]))
  }, [])

  const removeTask = useCallback(async (task) => {
    setTasks((ts) => ts.filter((t) => t.id !== task.id))
    const { error } = await supabase.from('tasks').update({ archived: true }).eq('id', task.id)
    if (error) load()
  }, [load])

  return { loading, tasks, completions, today, todayTasks, toggle, addTask, removeTask }
}
