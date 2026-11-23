// What Bob last saw, kept on this device so it opens without a connection. Wiped when signing out.
const PREFIX = 'bob-cache-'
const keyOf = (userId, name) => `${PREFIX}${userId}-${name}`

export function readCache(userId, name) {
  try { return JSON.parse(localStorage.getItem(keyOf(userId, name))) } catch { return null }
}

export function writeCache(userId, name, value) {
  try { localStorage.setItem(keyOf(userId, name), JSON.stringify(value)) } catch { /* full or private mode: Bob just needs a connection then */ }
}

export function clearCache() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
}
