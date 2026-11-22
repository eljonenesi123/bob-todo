import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A display name that's fine to show, or '' (sign-up can leave the email as the name)
export const cleanName = (name) => (name && !name.includes('@') ? name.trim() : '')

// The other person in Bob (there are exactly two accounts). Needs SQL 06 to see each other.
export function usePartner(userId) {
  const [partner, setPartner] = useState(null)

  useEffect(() => {
    let active = true
    supabase.from('profiles').select('id, display_name').neq('id', userId).limit(1).then(({ data }) => {
      if (active) setPartner(data?.[0] ?? null)
    })
    return () => { active = false }
  }, [userId])

  return { partner, partnerName: cleanName(partner?.display_name) }
}
