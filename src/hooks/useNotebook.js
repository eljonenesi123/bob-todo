import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { allRows } from '../lib/rows'

async function fetchNotebook() {
  const [p, i] = await Promise.all([
    allRows(() => supabase.from('notebook_pages').select('*').order('created_at').order('id')),
    allRows(() => supabase.from('notebook_items').select('*').order('position').order('created_at').order('id')),
  ])
  return { pages: p.data, items: i.data, error: p.error || i.error }
}

// Pages of the notebook: free text ('note') or something to tick ('list'). Own pages plus the ones shared with you.
export function useNotebook(userId) {
  const [state, setState] = useState({ pages: [], items: [], loading: true, failed: false })

  const apply = useCallback(({ pages, items, error }) => {
    setState((s) => (error
      ? { ...s, loading: false, failed: !s.pages.length }
      : { pages, items, loading: false, failed: false }))
  }, [])
  const load = useCallback(async () => apply(await fetchNotebook()), [apply])

  useEffect(() => {
    let active = true
    fetchNotebook().then((res) => { if (active) apply(res) })
    const channel = supabase
      .channel('bob-notebook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebook_pages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebook_items' }, load)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, apply, load])

  const putPage = useCallback((row) => setState((s) => ({
    ...s,
    pages: s.pages.some((p) => p.id === row.id) ? s.pages.map((p) => (p.id === row.id ? row : p)) : [...s.pages, row],
  })), [])

  // Save what was written. `base` is the version it was written on (null = a new page).
  // Answers { row }, { conflict: row } when the page changed elsewhere, { gone: true } when it was deleted, or { error }.
  const savePage = useCallback(async ({ id, kind, title, body, base }) => {
    const table = () => supabase.from('notebook_pages')
    const res = base
      ? await table().update({ title, body }).eq('id', id).eq('updated_at', base).select()
      : await table().insert({ id, kind, title, body }).select()
    let row = res.data?.[0]
    // 23505 = this new page was already saved, but we never got the answer
    if (res.error && res.error.code !== '23505') return { error: res.error }
    if (!row) {
      const now = await table().select('*').eq('id', id).maybeSingle()
      if (now.error) return { error: now.error }
      if (!now.data) return { gone: true }
      if (now.data.title !== title || now.data.body !== body) return { conflict: now.data }
      row = now.data
    }
    putPage(row)
    return { row }
  }, [putPage])

  // Pin or share. True when it worked.
  const setPage = useCallback(async (page, fields) => {
    const { data, error } = await supabase.from('notebook_pages').update(fields).eq('id', page.id).select()
    if (error || !data.length) { load(); return false }
    putPage(data[0])
    return true
  }, [load, putPage])

  const removePage = useCallback(async (page) => {
    const { error } = await supabase.from('notebook_pages').delete().eq('id', page.id)
    if (error) return false
    setState((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== page.id), items: s.items.filter((i) => i.page_id !== page.id) }))
    return true
  }, [])

  const addItem = useCallback(async (pageId, title, position) => {
    const { data, error } = await supabase.from('notebook_items').insert({ page_id: pageId, title, position }).select().single()
    if (error) return false
    setState((s) => (s.items.some((i) => i.id === data.id) ? s : { ...s, items: [...s.items, data] }))
    return true
  }, [])

  const toggleItem = useCallback(async (item) => {
    const done_at = item.done_at ? null : new Date().toISOString()
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? { ...i, done_at } : i)) }))
    const { error } = await supabase.from('notebook_items').update({ done_at }).eq('id', item.id)
    if (!error) return true
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === item.id ? item : i)) }))
    return false
  }, [])

  const removeItem = useCallback(async (item) => {
    const { error } = await supabase.from('notebook_items').delete().eq('id', item.id)
    if (error) return false
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }))
    return true
  }, [])

  return { ...state, reload: load, savePage, setPage, removePage, addItem, toggleItem, removeItem }
}
