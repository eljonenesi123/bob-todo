import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useProfile(userId) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let active = true
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
      if (!active || !data) return
      setProfile(data)
      // Keep her timezone up to date so nudges arrive at the right local time
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz && data.timezone !== tz) {
        supabase.from('profiles').update({ timezone: tz }).eq('id', userId).then(() => {})
      }
    })
    return () => { active = false }
  }, [userId])

  const update = useCallback(async (fields) => {
    setProfile((p) => ({ ...p, ...fields }))
    const { error } = await supabase.from('profiles').update(fields).eq('id', userId)
    return !error
  }, [userId])

  return { profile, update }
}
