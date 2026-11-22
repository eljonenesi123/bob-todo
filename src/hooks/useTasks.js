import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISO, addDays, isDueOn } from '../lib/dates'

// List order: the place she dragged it to, then oldest first
const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at)
// Column added in SQL 05; if it isn't there yet, save without it instead of failing
const missingColumn = (error) => error && (error.code === 'PGRST204' || error.code === '42703')

async function fetchAll() {
  const now = toISO()
  const [t, c, s] = await Promise.all([
    supabase.from('tasks').select('*').eq('archived', false).order('created_at'),
    supabase.from('task_completions').select('task_id, done_on').gte('done_on', addDays(now, -60)),
    supabase.from('subtasks').select('*').order('position').order('created_at'),
  ])
  return { t, c, s, now }
}

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [completions, setCompletions] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState(toISO())

  const apply = useCallback(({ t, c, s, now }) => {
    if (!t.error) setTasks([...t.data].sort(byPosition))
    if (!c.error) setCompletions(c.data)
    if (!s.error) setSubtasks(s.data)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, load)
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

  const stepsByTask = useMemo(() => {
    const map = new Map()
    for (const s of subtasks) map.set(s.task_id, [...(map.get(s.task_id) ?? []), s])
    return map
  }, [subtasks])

  const withSteps = useCallback((t, done) => ({ ...t, done, steps: stepsByTask.get(t.id) ?? [] }), [stepsByTask])

  const todayTasks = useMemo(() => {
    const onceIds = new Set(tasks.filter((t) => t.repeat === 'once').map((t) => t.id))
    const doneEarlier = new Set(
      completions.filter((c) => c.done_on < today && onceIds.has(c.task_id)).map((c) => c.task_id)
    )
    const doneToday = new Set(completions.filter((c) => c.done_on === today).map((c) => c.task_id))
    return tasks
      .filter((t) => isDueOn(t, today, doneEarlier))
      .map((t) => withSteps(t, doneToday.has(t.id)))
  }, [tasks, completions, today, withSteps])

  // What's planned on a future day: one-offs set for that day + repeating tasks
  const planFor = useCallback((iso) => {
    if (iso === today) return todayTasks
    return tasks
      .filter((t) => (t.repeat === 'once' ? t.due_on === iso : isDueOn(t, iso, new Set())))
      .map((t) => withSteps(t, false))
  }, [tasks, today, todayTasks, withSteps])

  const setDone = useCallback(async (task, done) => {
    if (!done) {
      setCompletions((cs) => cs.filter((c) => !(c.task_id === task.id && c.done_on === today)))
      const { error } = await supabase.from('task_completions').delete()
        .eq('task_id', task.id).eq('done_on', today)
      if (error) load()
    } else {
      setCompletions((cs) => (cs.some((c) => c.task_id === task.id && c.done_on === today) ? cs : [...cs, { task_id: task.id, done_on: today }]))
      const { error } = await supabase.from('task_completions')
        .upsert({ task_id: task.id, done_on: today }, { onConflict: 'task_id,done_on', ignoreDuplicates: true })
      if (error) load()
    }
  }, [today, load])

  const toggle = useCallback((task) => setDone(task, !task.done), [setDone])

  const addTask = useCallback(async ({ steps = [], ...fields }) => {
    const row = { ...fields, due_on: fields.due_on ?? toISO() }
    const position = tasks.reduce((max, t) => Math.max(max, t.position ?? 0), 0) + 1
    let res = await supabase.from('tasks').insert({ ...row, position }).select().single()
    if (missingColumn(res.error)) res = await supabase.from('tasks').insert(row).select().single()
    const { data, error } = res
    if (error) throw error
    setTasks((ts) => (ts.some((t) => t.id === data.id) ? ts : [...ts, data]))
    const clean = steps.map((s) => s.trim()).filter(Boolean)
    if (clean.length) {
      const rows = clean.map((title, i) => ({ task_id: data.id, title, position: i }))
      const res = await supabase.from('subtasks').insert(rows).select()
      if (!res.error) setSubtasks((ss) => [...ss, ...res.data])
    }
  }, [tasks])

  // Edit title, day, Big three, repeat, reminder, category
  const updateTask = useCallback(async (task, fields) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, ...fields } : t)))
    const { error } = await supabase.from('tasks').update(fields).eq('id', task.id)
    if (error) { load(); throw error }
  }, [load])

  // A one-off task goes to tomorrow's page (also takes it off today when it was carried over)
  const moveToTomorrow = useCallback((task) => updateTask(task, { due_on: addDays(today, 1) }), [updateTask, today])

  // Save a new order for the tasks she just dragged (ids in their new order)
  const reorder = useCallback(async (ids) => {
    // Reuse the positions this list already had, in sorted order; if some are equal
    // (old tasks all start at 0), spread them out from the smallest one
    let slots = ids.map((id) => tasks.find((t) => t.id === id)?.position ?? 0).sort((a, b) => a - b)
    if (new Set(slots).size < slots.length) slots = slots.map((_, i) => slots[0] + i)
    const next = new Map(ids.map((id, i) => [id, slots[i]]))
    const changed = tasks.filter((t) => next.has(t.id) && next.get(t.id) !== (t.position ?? 0))
    if (!changed.length) return
    setTasks((ts) => ts.map((t) => (next.has(t.id) ? { ...t, position: next.get(t.id) } : t)).sort(byPosition))
    const results = await Promise.all(changed.map((t) => supabase.from('tasks').update({ position: next.get(t.id) }).eq('id', t.id)))
    if (results.some((r) => r.error)) load()
  }, [tasks, load])

  const removeTask = useCallback(async (task) => {
    setTasks((ts) => ts.filter((t) => t.id !== task.id))
    const { error } = await supabase.from('tasks').update({ archived: true }).eq('id', task.id)
    if (error) load()
  }, [load])

  const addStep = useCallback(async (task, title) => {
    const clean = title.trim()
    if (!clean) return
    const position = (stepsByTask.get(task.id)?.length ?? 0)
    const { data, error } = await supabase.from('subtasks')
      .insert({ task_id: task.id, title: clean, position }).select().single()
    if (error) return load()
    setSubtasks((ss) => [...ss, data])
    // A new open step means the task isn't finished any more
    if (task.done) setDone(task, false)
  }, [stepsByTask, setDone, load])

  // Ticking the last step finishes the task; unticking a step reopens it
  // (canFinish is false when looking at a future day: steps can be ticked early, the task stays open)
  const toggleStep = useCallback(async (task, step, canFinish = true) => {
    const done_at = step.done_at ? null : new Date().toISOString()
    setSubtasks((ss) => ss.map((s) => (s.id === step.id ? { ...s, done_at } : s)))
    const { error } = await supabase.from('subtasks').update({ done_at }).eq('id', step.id)
    if (error) return load()
    if (!canFinish) return
    const after = task.steps.map((s) => (s.id === step.id ? { ...s, done_at } : s))
    const allDone = after.length > 0 && after.every((s) => s.done_at)
    if (allDone && !task.done) setDone(task, true)
    if (!allDone && task.done) setDone(task, false)
  }, [setDone, load])

  const removeStep = useCallback(async (step) => {
    setSubtasks((ss) => ss.filter((s) => s.id !== step.id))
    const { error } = await supabase.from('subtasks').delete().eq('id', step.id)
    if (error) load()
  }, [load])

  return {
    loading, tasks, completions, today, todayTasks, planFor,
    toggle, addTask, updateTask, moveToTomorrow, reorder, removeTask, addStep, toggleStep, removeStep,
  }
}
