import { supabase } from './supabase'

// The session as it lies on this device, even when it expired and can't be renewed without a connection.
// Enough to show what Bob last saw; every request still needs a real session.
export function storedSession() {
  try {
    const s = JSON.parse(localStorage.getItem(supabase.auth.storageKey))
    return s?.user?.id ? { user: s.user } : null
  } catch { return null }
}

// Is this person really signed in right now? Without this check a request could go out as "nobody" while
// the session can't be renewed: reading would answer empty lists, and changing would quietly do nothing.
export async function signedIn(userId) {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: {} }))
  return data?.session?.user?.id === userId
}

export const NOT_SIGNED_IN = { message: 'No connection' }
