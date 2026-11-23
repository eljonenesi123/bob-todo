import { supabase } from './supabase'
import { allRows } from './rows'
import { toISO } from './dates'
import { flush, outboxState } from './outbox'
import { signedIn } from './session'

// Everything this person has in Bob, as one file. Locked groups stay encrypted in it.
export async function makeBackup(userId) {
  await flush()
  if (!await signedIn(userId)) throw new Error('No connection')
  if (outboxState().pending) throw new Error('Some changes were not sent yet')
  const all = async (makeQuery) => {
    const { data, error } = await allRows(makeQuery)
    if (error) throw error
    return data
  }
  const from = (table) => supabase.from(table).select('*')
  const [profile, tasks, done, steps, groups, notes, countdowns, letters, rewards] = await Promise.all([
    all(() => from('profiles').eq('id', userId).order('id')),
    all(() => from('tasks').eq('user_id', userId).order('created_at').order('id')), // deleted ones too
    all(() => from('task_completions').eq('user_id', userId).order('done_on').order('task_id')),
    all(() => from('subtasks').eq('user_id', userId).order('task_id').order('position').order('id')),
    all(() => from('notebook_pages').order('created_at').order('id')),
    all(() => from('notebook_items').order('created_at').order('id')),
    all(() => from('countdowns').order('on_date').order('id')),
    all(() => from('notes').or(`recipient_id.eq.${userId},author_id.eq.${userId}`).order('created_at').order('id')),
    all(() => from('rewards').or(`recipient_id.eq.${userId},author_id.eq.${userId}`).order('created_at').order('id')),
  ])
  const data = {
    app: 'Bob', version: 1, made_at: new Date().toISOString(),
    about: 'A copy of your data in Bob. Locked notebook groups are encrypted and need their PIN. Photos and letters you haven’t opened yet are not included.',
    profile: profile[0] ?? null,
    tasks, task_completions: done, steps,
    notebook_groups: groups, notebook_notes: notes, countdowns,
    // A sealed letter stays sealed
    letters: letters.filter((l) => l.author_id === userId || l.opened_at),
    rewards,
  }
  return new File([JSON.stringify(data, null, 2)], `bob-backup-${toISO()}.json`, { type: 'application/json' })
}

const phone = () => /iphone|ipad|ipod|android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// On a phone the share sheet ("Save to Files"), on a computer a download.
// Must be called straight from a tap. True when it was saved or shared, false when it was cancelled.
export async function saveFile(file) {
  if (phone() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch (e) {
      if (e.name === 'AbortError') return false
      throw e
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return true
}
