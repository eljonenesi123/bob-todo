import { useEffect, useState } from 'react'
import { isSealed, unseal } from '../lib/vault'

// The notes of an open group in readable form. `list` is null while they're being decrypted.
export function useOpenNotes(group, notes, key) {
  const [open, setOpen] = useState({ key: null, list: null })

  useEffect(() => {
    if (!key) return
    let active = true
    Promise.all(notes.map(async (n) => {
      if (!isSealed(n)) return n
      try {
        return { ...n, ...await unseal(key, group.id, n.id, n.body) }
      } catch {
        return { ...n, title: 'This note can’t be opened', body: '', broken: true }
      }
    })).then((list) => { if (active) setOpen({ key, list }) })
    return () => { active = false }
  }, [group.id, notes, key])

  if (!group.lock) return notes
  return key && open.key === key ? open.list : null
}
