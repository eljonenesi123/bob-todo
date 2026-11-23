// Signing in means leaving Bob to read the email, and an iPhone may close Bob meanwhile.
// So we remember for a while which address a code was sent to, and come back to that step.
const KEY = 'bob-signin'
const KEEP_MS = 15 * 60000
export const RESEND_S = 60 // Supabase sends one code a minute at most

export function readPending() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY))
    const age = Date.now() - p.sentAt
    return p.email && age >= 0 && age < KEEP_MS ? p : null
  } catch { return null }
}
export function savePending(p) { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ } }
export function clearPending() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

// No answer at all. A server error (like the mail not going out) has a status and isn't the connection's fault.
const offline = (error) => !error.status

export function sendError(error) {
  if (offline(error)) return 'Bob couldn’t connect. Check your connection and try again.'
  if (error.status === 429) return 'A code was sent a moment ago. Wait a minute, then try again.'
  if (['signup_disabled', 'otp_disabled', 'user_not_found'].includes(error.code)) return 'There’s no Bob account with this email. Check the spelling.'
  if (['email_address_invalid', 'validation_failed'].includes(error.code)) return 'That email doesn’t look right. Check the spelling.'
  return 'The code wasn’t sent. Wait a minute, then try again.'
}

export function verifyError(error) {
  if (offline(error)) return 'Bob couldn’t connect. Check your connection and try again.'
  if (error.status === 429) return 'Too many tries. Wait a minute, then try again.'
  return 'That code didn’t work. Check it, or send a new one.'
}
