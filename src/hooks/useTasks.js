import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISO, addDays, isDueOn } from '../lib/dates'
import { allRows } from '../lib/rows'
import { readCache, writeCache } from '../lib/cache'
import { signedIn, NOT_SIGNED_IN } from '../lib/session'
import { flush, write, withPending, onRefused, onOutbox, outboxState, sentCount } from '../lib/outbox'

// List order: the place she dragged it to, then oldest first
const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at)

async function fetchAll(userId, again = 2) {
  // First send what waits here, so the answer already has it
  await flush()
  const now = toISO()
  if (!await signedIn(userId)) return { error: NOT_SIGNED_IN, now }
  const since = addDays(now, -60)
  const before = sentCount()
  const [t, recent, older, s] = await Promise.all([
    allRows(() => supabase.from('tasks').select('*').eq('archived', false).order('created_at').order('id')),
    // Streaks and Progress look back 60 days
    allRows(() => supabase.from('task_completions').select('task_id, done_on').gte('done_on', since).order('done_on').order('task_id')),
    // One-off tasks finished before that must stay finished, or they would carry over onto today's list again
    allRows(() => supabase.from('task_completions').select('task_id, done_on, tasks!inner(repeat)')
      .eq('tasks.repeat', 'once').eq('tasks.archived', false).lt('done_on', since).order('done_on').order('task_id')),
    allRows(() => supabase.from('subtasks').select('*').order('position').order('created_at').order('id')),
  ])
  // Tasks without their completions would all look unfinished, so it's everything or nothing
  const error = t.error || recent.error || older.error || s.error
  if (error) return { error, now }
  if (sentCount() !== before && again) return fetchAll(userId, again - 1)
  return {
    now,
    tasks: t.data,
    completions: [...older.data.map(({ task_id, done_on }) => ({ task_id, done_on })), ...recent.data],
    subtasks: s.data,
  }
}

export function useTasks(userId) {
  const [cached] = useState(() => readCache(userId, 'tasks'))
  const [tasks, setTasks] = useState(cached?.tasks ?? [])
  const [completions, setCompletions] = useState(cached?.completions ?? [])
  const [subtasks, setSubtasks] = useState(cached?.subtasks ?? [])
  const [loading, setLoading] = useState(!cached)
  const [loaded, setLoaded] = useState(!!cached) // there is something to show, from here or from the server
  const [today, setToday] = useState(toISO())

  const apply = useCallback((res) => {
    setToday(res.now)
    setLoading(false)
    if (res.error) return
    setTasks(withPending('tasks', res.tasks).filter((t) => !t.archived).sort(byPosition))
    setCompletions(withPending('task_completions', res.completions))
    setSubtasks(withPending('subtasks', res.subtasks))
    setLoaded(true)
  }, [])

  // Used by event handlers (realtime, focus, refused changes)
  const load = useCallback(async () => apply(await fetchAll(userId)), [apply, userId])

  useEffect(() => {
    let active = true
    fetchAll(userId).then((res) => { if (active) apply(res) })
    // Live sync between her phone and PC
    const channel = supabase
      .channel('bob-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, load)
      .subscribe()
    // Refresh when she comes back to the app (also handles midnight rollover) or the connection does
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', load)
    const offRefused = onRefused(load)
    // Waiting changes got through: see what changed elsewhere meanwhile
    let wasStuck = outboxState().stuck
    const offOutbox = onOutbox(() => {
      const { stuck, pending } = outboxState()
      if (wasStuck && !stuck && !pending) load()
      wasStuck = stuck || (wasStuck && pending > 0)
    })
    return () => {
      active = false
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', load)
      offRefused()
      offOutbox()
    }
  }, [apply, load, userId])

  // Remember the list for opening without a connection
  useEffect(() => {
    if (loaded) writeCache(userId, 'tasks', { tasks, completions, subtasks })
  }, [userId, loaded, tasks, completions, subtasks])

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

  // Every change shows at once, then goes through the outbox (sent now, or later without a connection).
  // False when the server refused it; the list is then put right again.
  const change = useCallback(async (op) => {
    const { error } = await write(op)
    if (error) load()
    return !error
  }, [load])

  const setDone = useCallback((task, done) => {
    const row = { task_id: task.id, done_on: today }
    if (!done) {
      setCompletions((cs) => cs.filter((c) => !(c.task_id === task.id && c.done_on === today)))
      return change({ table: 'task_completions', type: 'delete', match: row })
    }
    setCompletions((cs) => (cs.some((c) => c.task_id === task.id && c.done_on === today) ? cs : [...cs, row]))
    return change({ table: 'task_completions', type: 'upsert', row, onConflict: 'task_id,done_on' })
  }, [today, change])

  const toggle = useCallback((task) => setDone(task, !task.done), [setDone])

  const addTask = useCallback(async ({ steps = [], ...fields }) => {
    const created_at = new Date().toISOString()
    const position = tasks.reduce((max, t) => Math.max(max, t.position ?? 0), 0) + 1
    const row = { ...fields, id: crypto.randomUUID(), due_on: fields.due_on ?? toISO(), archived: false, position, created_at }
    setTasks((ts) => [...ts, row])
    const stepRows = steps.map((s) => s.trim()).filter(Boolean)
      .map((title, i) => ({ id: crypto.randomUUID(), task_id: row.id, title, done_at: null, position: i, created_at }))
    setSubtasks((ss) => [...ss, ...stepRows])
    if (!await change({ table: 'tasks', type: 'insert', row })) throw new Error('The task was refused')
    for (const s of stepRows) await change({ table: 'subtasks', type: 'insert', row: s })
  }, [tasks, change])

  // Edit title, day, Big three, repeat, reminder, category
  const updateTask = useCallback(async (task, fields) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, ...fields } : t)))
    if (!await change({ table: 'tasks', type: 'update', match: { id: task.id }, fields })) throw new Error('The change was refused')
  }, [change])

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
    await Promise.all(changed.map((t) => change({ table: 'tasks', type: 'update', match: { id: t.id }, fields: { position: next.get(t.id) } })))
  }, [tasks, change])

  // Deleting hides the task (archived), so it can come back. True when it worked.
  const removeTask = useCallback((task) => {
    setTasks((ts) => ts.filter((t) => t.id !== task.id))
    return change({ table: 'tasks', type: 'update', match: { id: task.id }, fields: { archived: true } })
  }, [change])

  const restoreTask = useCallback((task) => {
    // eslint-disable-next-line no-unused-vars
    const { done, steps, ...row } = task // what Today added for showing it
    setTasks((ts) => (ts.some((t) => t.id === row.id) ? ts : [...ts, row].sort(byPosition)))
    return change({ table: 'tasks', type: 'update', match: { id: task.id }, fields: { archived: false } })
  }, [change])

  const addStep = useCallback(async (task, title) => {
    const clean = title.trim()
    if (!clean) return
    const row = { id: crypto.randomUUID(), task_id: task.id, title: clean, done_at: null, position: stepsByTask.get(task.id)?.length ?? 0, created_at: new Date().toISOString() }
    setSubtasks((ss) => [...ss, row])
    // A new open step means the task isn't finished any more
    if (await change({ table: 'subtasks', type: 'insert', row }) && task.done) setDone(task, false)
  }, [stepsByTask, setDone, change])

  // Ticking the last step finishes the task; unticking a step reopens it
  // (canFinish is false when looking at a future day: steps can be ticked early, the task stays open)
  const toggleStep = useCallback(async (task, step, canFinish = true) => {
    const done_at = step.done_at ? null : new Date().toISOString()
    setSubtasks((ss) => ss.map((s) => (s.id === step.id ? { ...s, done_at } : s)))
    if (!await change({ table: 'subtasks', type: 'update', match: { id: step.id }, fields: { done_at } }) || !canFinish) return
    const after = task.steps.map((s) => (s.id === step.id ? { ...s, done_at } : s))
    const allDone = after.length > 0 && after.every((s) => s.done_at)
    if (allDone && !task.done) setDone(task, true)
    if (!allDone && task.done) setDone(task, false)
  }, [setDone, change])

  const removeStep = useCallback((step) => {
    setSubtasks((ss) => ss.filter((s) => s.id !== step.id))
    return change({ table: 'subtasks', type: 'delete', match: { id: step.id } })
  }, [change])

  // The same step again, in its old place
  const restoreStep = useCallback(({ id, task_id, title, done_at, position, created_at }) => {
    const row = { id, task_id, title, done_at, position, created_at }
    setSubtasks((ss) => (ss.some((s) => s.id === id) ? ss : [...ss, row].sort(byPosition)))
    return change({ table: 'subtasks', type: 'insert', row })
  }, [change])

  return {
    loading, failed: !loading && !loaded, reload: load, tasks, completions, today, todayTasks, planFor,
    toggle, addTask, updateTask, moveToTomorrow, reorder, removeTask, restoreTask, addStep, toggleStep, removeStep, restoreStep,
  }
}
