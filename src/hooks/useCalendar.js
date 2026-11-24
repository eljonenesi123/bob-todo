import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { allRows } from '../lib/rows'
import { readCache, writeCache } from '../lib/cache'
import { signedIn, NOT_SIGNED_IN } from '../lib/session'

const table = () => supabase.from('calendar_entries')

async function fetchEntries(userId) {
  if (!await signedIn(userId)) return { error: NOT_SIGNED_IN }
  return allRows(() => table().select('*').order('starts_on').order('id'))
}

// Calendar entries: your own, plus the ones shared with you (to look at)
export function useCalendar(userId) {
  const [state, setState] = useState(() => {
    const entries = readCache(userId, 'calendar')
    return { entries: entries ?? [], loading: !entries, failed: false, loaded: !!entries }
  })

  const apply = useCallback(({ data, error }) => {
    setState((s) => (error ? { ...s, loading: false, failed: !s.loaded } : { entries: data, loading: false, failed: false, loaded: true }))
  }, [])
  const load = useCallback(async () => apply(await fetchEntries(userId)), [apply, userId])

  useEffect(() => { if (state.loaded) writeCache(userId, 'calendar', state.entries) }, [userId, state.loaded, state.entries])

  useEffect(() => {
    let active = true
    fetchEntries(userId).then((res) => { if (active) apply(res) })
    const channel = supabase
      .channel('bob-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries' }, load)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', load)
    return () => {
      active = false
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', load)
    }
  }, [userId, apply, load])

  // Without a real session a change would quietly do nothing
  const check = useCallback(async () => { if (!await signedIn(userId)) throw NOT_SIGNED_IN }, [userId])

  // With moved_from and moved_day in it, the entry it takes the place of changes too (a trigger does that)
  const add = useCallback(async (fields) => {
    await check()
    const { data, error } = await table().insert(fields).select().single()
    if (error) throw error
    setState((s) => ({
      ...s,
      entries: [...s.entries.filter((e) => e.id !== data.id), data]
        .map((e) => (e.id === data.moved_from && !e.skipped.includes(data.moved_day) ? { ...e, skipped: [...e.skipped, data.moved_day] } : e)),
    }))
  }, [check])

  const update = useCallback(async (entry, fields) => {
    await check()
    const { data, error } = await table().update(fields).eq('id', entry.id).select().single()
    if (error) { load(); throw error }
    setState((s) => ({ ...s, entries: s.entries.map((e) => (e.id === data.id ? data : e)) }))
  }, [check, load])

  const remove = useCallback(async (entry) => {
    await check()
    const { error } = await table().delete().eq('id', entry.id)
    if (error) throw error
    setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== entry.id) }))
  }, [check])

  // Bring back what was just deleted. It no longer needs to know whose place it took.
  const restore = useCallback((entry) => add({ ...entry, moved_from: null, moved_day: null }), [add])

  return { ...state, reload: load, add, update, remove, restore }
}
