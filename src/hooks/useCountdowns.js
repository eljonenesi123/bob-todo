import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { allRows } from '../lib/rows'
import { readCache, writeCache } from '../lib/cache'
import { signedIn, NOT_SIGNED_IN } from '../lib/session'

async function fetchCountdowns(userId) {
  if (!await signedIn(userId)) return { error: NOT_SIGNED_IN }
  return allRows(() => supabase.from('countdowns').select('*').order('on_date').order('id'))
}
const byDate = (a, b) => a.on_date.localeCompare(b.on_date) || a.created_at.localeCompare(b.created_at)

// Trips and other days to look forward to: your own, plus the ones shared with you
export function useCountdowns(userId) {
  const [state, setState] = useState(() => {
    const items = readCache(userId, 'countdowns')
    return { items: items ?? [], loading: !items, failed: false, loaded: !!items }
  })

  const apply = useCallback(({ data, error }) => {
    setState((s) => (error ? { ...s, loading: false, failed: !s.loaded } : { items: [...data].sort(byDate), loading: false, failed: false, loaded: true }))
  }, [])
  const load = useCallback(async () => apply(await fetchCountdowns(userId)), [apply, userId])

  useEffect(() => { if (state.loaded) writeCache(userId, 'countdowns', state.items) }, [userId, state.loaded, state.items])

  useEffect(() => {
    let active = true
    fetchCountdowns(userId).then((res) => { if (active) apply(res) })
    const channel = supabase
      .channel('bob-countdowns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'countdowns' }, load)
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

  const put = useCallback((row) => setState((s) => ({ ...s, items: [...s.items.filter((c) => c.id !== row.id), row].sort(byDate) })), [])

  const add = useCallback(async (fields) => {
    const { data, error } = await supabase.from('countdowns').insert(fields).select().single()
    if (error) throw error
    put(data)
  }, [put])

  const update = useCallback(async (item, fields) => {
    const { data, error } = await supabase.from('countdowns').update(fields).eq('id', item.id).select().single()
    if (error) { load(); throw error }
    put(data)
  }, [load, put])

  const remove = useCallback(async (item) => {
    const { error } = await supabase.from('countdowns').delete().eq('id', item.id)
    if (error) throw error
    setState((s) => ({ ...s, items: s.items.filter((c) => c.id !== item.id) }))
  }, [])

  return { ...state, reload: load, add, update, remove }
}
