import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readCache, writeCache } from '../lib/cache'
import { signedIn } from '../lib/session'

// A display name that's fine to show, or '' (sign-up can leave the email as the name)
export const cleanName = (name) => (name && !name.includes('@') ? name.trim() : '')

// The other person in Bob (there are exactly two accounts). Needs SQL 06 to see each other.
export function usePartner(userId) {
  const [partner, setPartner] = useState(() => readCache(userId, 'partner'))

  useEffect(() => {
    let active = true
    async function load() {
      if (!await signedIn(userId)) return
      const { data, error } = await supabase.from('profiles').select('id, display_name').neq('id', userId).limit(1)
      if (!active || error) return
      setPartner(data[0] ?? null)
      writeCache(userId, 'partner', data[0] ?? null)
    }
    load()
    window.addEventListener('online', load)
    return () => { active = false; window.removeEventListener('online', load) }
  }, [userId])

  return { partner, partnerName: cleanName(partner?.display_name) }
}
