// The focus session lives in localStorage so it survives closing the app.
// It stores the end time, so the countdown stays right even while the phone is locked.
const KEY = 'bob-focus'

export function readFocus() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function saveFocus(session) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch { /* ignore */ }
}
