import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { allRows } from '../lib/rows'

// Groups live in the table notebook_pages, the notes inside them in notebook_items
async function fetchNotebook() {
  const [g, n] = await Promise.all([
    allRows(() => supabase.from('notebook_pages').select('*').order('created_at').order('id')),
    allRows(() => supabase.from('notebook_items').select('*').order('created_at').order('id')),
  ])
  return { groups: g.data, notes: n.data, error: g.error || n.error }
}

const put = (rows, row) => (rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row])

// Your own groups plus the ones shared with you
export function useNotebook(userId) {
  const [state, setState] = useState({ groups: [], notes: [], loading: true, failed: false })

  const apply = useCallback(({ groups, notes, error }) => {
    setState((s) => (error
      ? { ...s, loading: false, failed: !s.groups.length }
      : { groups, notes, loading: false, failed: false }))
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

  // New group, or changes to one. Answers the saved group.
  const saveGroup = useCallback(async (group, fields) => {
    const table = supabase.from('notebook_pages')
    const { data, error } = group
      ? await table.update(fields).eq('id', group.id).select().single()
      : await table.insert({ ...fields, kind: 'list' }).select().single()
    if (error) { load(); throw error }
    setState((s) => ({ ...s, groups: put(s.groups, data) }))
    return data
  }, [load])

  const removeGroup = useCallback(async (group) => {
    const { error } = await supabase.from('notebook_pages').delete().eq('id', group.id)
    if (error) throw error
    setState((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== group.id), notes: s.notes.filter((n) => n.page_id !== group.id) }))
  }, [])

  // New note, or changes to one. `note` is the version that was opened: if it changed elsewhere
  // since then, nothing is overwritten and the answer is { conflict } (or { gone } when deleted).
  const saveNote = useCallback(async (note, groupId, fields) => {
    const table = () => supabase.from('notebook_items')
    const { data, error } = note
      ? await table().update(fields).eq('id', note.id).eq('updated_at', note.updated_at).select()
      : await table().insert({ ...fields, page_id: groupId }).select()
    if (error) throw error
    let row = data[0]
    if (!row) {
      const now = await table().select('*').eq('id', note.id).maybeSingle()
      if (now.error) throw now.error
      if (!now.data) return { gone: true }
      // Our own save may have gone through without us getting the answer
      if (now.data.title !== fields.title || now.data.body !== fields.body) return { conflict: now.data }
      row = now.data
    }
    setState((s) => ({ ...s, notes: put(s.notes, row) }))
    return { row }
  }, [])

  const removeNote = useCallback(async (note) => {
    const { error } = await supabase.from('notebook_items').delete().eq('id', note.id)
    if (error) throw error
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== note.id) }))
  }, [])

  return { ...state, reload: load, saveGroup, removeGroup, saveNote, removeNote }
}
