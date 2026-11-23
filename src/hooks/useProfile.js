import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readCache, writeCache } from '../lib/cache'
import { signedIn } from '../lib/session'

export function useProfile(userId) {
  const [profile, setProfile] = useState(() => readCache(userId, 'profile'))

  useEffect(() => {
    let active = true
    async function load() {
      if (!await signedIn(userId)) return
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (!active || !data) return
      setProfile(data)
      // Keep her timezone up to date so nudges arrive at the right local time
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz && data.timezone !== tz) {
        supabase.from('profiles').update({ timezone: tz }).eq('id', userId).then(() => {})
      }
    }
    load()
    window.addEventListener('online', load)
    return () => { active = false; window.removeEventListener('online', load) }
  }, [userId])

  useEffect(() => { if (profile) writeCache(userId, 'profile', profile) }, [userId, profile])

  const update = useCallback(async (fields) => {
    setProfile((p) => ({ ...p, ...fields }))
    const { error } = await supabase.from('profiles').update(fields).eq('id', userId)
    return !error
  }, [userId])

  return { profile, update }
}
