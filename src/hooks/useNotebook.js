import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { allRows } from '../lib/rows'
import { readCache, writeCache } from '../lib/cache'
import { signedIn, NOT_SIGNED_IN } from '../lib/session'
import { makeLock, openLock, changeLock, isSealed, seal, unseal } from '../lib/vault'

const LOCK_AFTER = 60000 // away this long: locked groups close again

// Groups live in the table notebook_pages, the notes inside them in notebook_items
async function fetchNotebook(userId) {
  if (!await signedIn(userId)) return { error: NOT_SIGNED_IN }
  const [g, n] = await Promise.all([
    allRows(() => supabase.from('notebook_pages').select('*').order('created_at').order('id')),
    allRows(() => supabase.from('notebook_items').select('*').order('created_at').order('id')),
  ])
  return { groups: g.data, notes: n.data, error: g.error || n.error }
}

const put = (rows, row) => (rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row])
const items = () => supabase.from('notebook_items')
const pages = () => supabase.from('notebook_pages')

// Every note of a group as the server has it now
async function notesOf(groupId) {
  const { data, error } = await allRows(() => items().select('*').eq('page_id', groupId).order('created_at').order('id'))
  if (error) throw error
  return data
}

// Your own groups plus the ones shared with you
export function useNotebook(userId) {
  const [state, setState] = useState(() => {
    const kept = readCache(userId, 'notebook')
    return { groups: kept?.groups ?? [], notes: kept?.notes ?? [], loading: !kept, failed: false, loaded: !!kept }
  })
  // Keys of the groups that are open right now, by lock. Only in memory, never saved.
  const [keys, setKeys] = useState(() => new Map())

  const apply = useCallback(({ groups, notes, error }) => {
    setState((s) => (error
      ? { ...s, loading: false, failed: !s.loaded }
      : { groups, notes, loading: false, failed: false, loaded: true }))
  }, [])
  const load = useCallback(async () => apply(await fetchNotebook(userId)), [apply, userId])

  // Locked groups are kept as the database has them: encrypted
  useEffect(() => {
    if (state.loaded) writeCache(userId, 'notebook', { groups: state.groups, notes: state.notes })
  }, [userId, state.loaded, state.groups, state.notes])

  useEffect(() => {
    let active = true
    fetchNotebook(userId).then((res) => { if (active) apply(res) })
    const channel = supabase
      .channel('bob-notebook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebook_pages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebook_items' }, load)
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

  // ---------- locking by itself ----------
  // Not while a note is being written (those words would be lost), but right after
  const writing = useRef(false)
  const due = useRef(false)
  const lockAll = useCallback(() => {
    if (writing.current) { due.current = true; return }
    due.current = false
    setKeys((k) => (k.size ? new Map() : k))
  }, [])
  const setWriting = useCallback((on) => {
    writing.current = on
    if (!on && due.current) lockAll()
  }, [lockAll])

  useEffect(() => {
    let since = 0
    let timer = null
    const onChange = () => {
      clearTimeout(timer)
      if (document.visibilityState === 'hidden') {
        since = Date.now()
        timer = setTimeout(lockAll, LOCK_AFTER) // a phone may stop timers, so we check again on return
      } else if (since && Date.now() - since >= LOCK_AFTER) lockAll()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onChange) }
  }, [lockAll])

  const keyOf = useCallback((group) => (group.lock ? keys.get(group.lock.kid) ?? null : null), [keys])
  const keep = useCallback((kid, key) => setKeys((k) => new Map(k).set(kid, key)), [])
  const putNotes = useCallback((rows) => setState((s) => ({ ...s, notes: rows.reduce(put, s.notes) })), [])

  // Encrypt what still lies open in a locked group (just locked, or added by an older Bob).
  // A note changed elsewhere meanwhile is left for the next time.
  const sealAll = useCallback(async (group, key) => {
    const open = (await notesOf(group.id)).filter((n) => !isSealed(n))
    const done = []
    for (const n of open) {
      const { data, error } = await items().update(await seal(key, group, n.id, n)).eq('id', n.id).eq('updated_at', n.updated_at).select()
      if (error) throw error
      done.push(...data)
    }
    putNotes(done)
    return open.length - done.length
  }, [putNotes])

  // True, or false when the PIN is wrong
  const unlock = useCallback(async (group, pin) => {
    const key = await openLock(group.lock, pin, group.id)
    if (!key) return false
    keep(group.lock.kid, key)
    sealAll(group, key).catch(() => {}) // tidying up can wait for a connection
    return true
  }, [keep, sealAll])

  const lockGroup = useCallback(async (group, pin) => {
    const { lock, key } = await makeLock(pin, group.id)
    const { data, error } = await pages().update({ lock }).eq('id', group.id).is('lock', null).select().single()
    if (error) { load(); throw error }
    keep(lock.kid, key)
    setState((s) => ({ ...s, groups: put(s.groups, data) }))
    // The lock is on; if the connection drops here, the rest is encrypted the next time the group is opened
    const left = await sealAll(data, key).catch(() => 1)
    return { all: left === 0 }
  }, [keep, load, sealAll])

  // True, or false when the old PIN is wrong
  const changePin = useCallback(async (group, oldPin, newPin) => {
    const lock = await changeLock(group.lock, oldPin, newPin, group.id)
    if (!lock) return false
    const { data, error } = await pages().update({ lock }).eq('id', group.id).eq('lock->>data', group.lock.data).select().single()
    if (error) { load(); throw error }
    setState((s) => ({ ...s, groups: put(s.groups, data) }))
    return true
  }, [load])

  // Everything readable again, and only then the lock goes
  const removeLock = useCallback(async (group) => {
    const key = keyOf(group)
    for (const n of (await notesOf(group.id)).filter(isSealed)) {
      const plain = await unseal(key, group.id, n.id, n.body)
      const { error } = await items().update({ title: plain.title, body: plain.body }).eq('id', n.id).eq('updated_at', n.updated_at)
      if (error) throw error
    }
    const rest = await notesOf(group.id)
    if (rest.some(isSealed)) throw new Error('A note changed meanwhile')
    const { data, error } = await pages().update({ lock: null }).eq('id', group.id).select().single()
    if (error) throw error
    setState((s) => ({ ...s, groups: put(s.groups, data), notes: rest.reduce(put, s.notes) }))
  }, [keyOf])

  // ---------- groups and notes ----------

  // New group, or changes to one. Answers the saved group.
  const saveGroup = useCallback(async (group, fields) => {
    const { data, error } = group
      ? await pages().update(fields).eq('id', group.id).select().single()
      : await pages().insert({ ...fields, kind: 'list' }).select().single()
    if (error) { load(); throw error }
    setState((s) => ({ ...s, groups: put(s.groups, data) }))
    return data
  }, [load])

  const removeGroup = useCallback(async (group) => {
    const { error } = await pages().delete().eq('id', group.id)
    if (error) throw error
    setState((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== group.id), notes: s.notes.filter((n) => n.page_id !== group.id) }))
  }, [])

  // New note, or changes to one. `note` is the version that was opened: if it changed elsewhere
  // since then, nothing is overwritten and the answer is { conflict } (or { gone } when deleted).
  const saveNote = useCallback(async (note, group, fields) => {
    const key = keyOf(group)
    if (group.lock && !key) throw new Error('This group is locked')
    const id = note?.id ?? crypto.randomUUID()
    const stored = key ? await seal(key, group, id, fields) : fields
    const { data, error } = note
      ? await items().update(stored).eq('id', id).eq('updated_at', note.updated_at).select()
      : await items().insert({ ...stored, id, page_id: group.id }).select()
    if (error) { load(); throw error } // perhaps the lock changed on another device
    let row = data[0]
    if (!row) {
      const now = await items().select('*').eq('id', id).maybeSingle()
      if (now.error) throw now.error
      if (!now.data) return { gone: true }
      const theirs = key && isSealed(now.data) ? await unseal(key, group.id, id, now.data.body) : now.data
      // Our own save may have gone through without us getting the answer
      if (theirs.title !== fields.title || theirs.body !== fields.body) return { conflict: { ...now.data, title: theirs.title, body: theirs.body } }
      row = now.data
    }
    putNotes([row])
    return { row }
  }, [keyOf, putNotes, load])

  const removeNote = useCallback(async (note) => {
    const { error } = await items().delete().eq('id', note.id)
    if (error) throw error
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== note.id) }))
  }, [])

  return {
    ...state, reload: load, saveGroup, removeGroup, saveNote, removeNote,
    keyOf, unlock, lockGroup, changePin, removeLock, lockNow: lockAll, setWriting,
  }
}
