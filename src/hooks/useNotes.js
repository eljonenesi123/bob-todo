import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Letters (table "notes") and rewards for this user, plus the letters they wrote, to show what a reply answers
async function fetchMine(userId) {
  const [n, r] = await Promise.all([
    supabase.from('notes').select('*').or(`recipient_id.eq.${userId},author_id.eq.${userId}`).order('created_at'),
    supabase.from('rewards').select('*').eq('recipient_id', userId).order('streak_required'),
  ])
  const notes = n.data ?? []
  const authorIds = [...new Set(notes.map((x) => x.author_id))]
  let authors = {}
  if (authorIds.length) {
    const { data } = await supabase.from('profiles').select('id, display_name').in('id', authorIds)
    authors = Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name]))
  }
  return { notes, rewards: r.data ?? [], authors }
}

export function useNotes(userId) {
  const [state, setState] = useState({ notes: [], rewards: [], authors: {}, loaded: false })

  const load = useCallback(async () => {
    const res = await fetchMine(userId)
    setState({ ...res, loaded: true })
  }, [userId])

  useEffect(() => {
    let active = true
    fetchMine(userId).then((res) => { if (active) setState({ ...res, loaded: true }) })
    // Surprise notes appear at their delivery time, so check now and then
    const timer = setInterval(load, 120000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, load])

  const derived = useMemo(() => {
    const notes = state.notes.filter((n) => n.recipient_id === userId)
    const locked = notes.filter((n) => n.kind === 'day_complete' && !n.opened_at)
    const surprises = notes.filter((n) => n.kind !== 'day_complete' && !n.opened_at)
    const opened = notes.filter((n) => n.opened_at).sort((a, b) => b.opened_at.localeCompare(a.opened_at))
    return { locked, nextLocked: locked[0] ?? null, surprises, opened, hasNew: surprises.length > 0 }
  }, [state, userId])

  const openNote = useCallback(async (note) => {
    const opened_at = new Date().toISOString()
    setState((s) => ({ ...s, notes: s.notes.map((n) => (n.id === note.id ? { ...n, opened_at } : n)) }))
    await supabase.from('notes').update({ opened_at }).eq('id', note.id)
  }, [])

  const claimReward = useCallback(async (reward) => {
    const claimed_at = new Date().toISOString()
    setState((s) => ({ ...s, rewards: s.rewards.map((r) => (r.id === reward.id ? { ...r, claimed_at } : r)) }))
    await supabase.from('rewards').update({ claimed_at }).eq('id', reward.id)
  }, [])

  // What this user answered to a letter
  const repliesTo = useCallback((note) => state.notes.filter((n) => n.reply_to === note.id && n.author_id === userId), [state.notes, userId])
  // The letter a reply answers (if it still exists)
  const answers = useCallback((note) => (note.reply_to ? state.notes.find((n) => n.id === note.reply_to) ?? null : null), [state.notes])

  // True when the reply was saved. It arrives right away, with a notification.
  const sendReply = useCallback(async (note, body) => {
    const { data, error } = await supabase.from('notes').insert({
      recipient_id: note.author_id, body, kind: 'reply', reply_to: note.id, deliver_at: new Date().toISOString(),
    }).select().single()
    if (error) return false
    setState((s) => ({ ...s, notes: [...s.notes, data] }))
    return true
  }, [])

  const authorName = useCallback((note) => state.authors[note.author_id] || 'someone special', [state.authors])

  return { ...state, ...derived, openNote, claimReward, authorName, repliesTo, answers, sendReply, reload: load }
}
