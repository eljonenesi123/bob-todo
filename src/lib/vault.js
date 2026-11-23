// Locking a notebook group with a PIN. Everything is encrypted here, on the device (AES-256-GCM).
// Each group has its own random key; the database keeps that key only wrapped with the PIN (PBKDF2).
// The PIN itself is never stored or sent. A short PIN can be guessed by someone who has the database
// and a fast computer, so a longer one is safer. Nobody can open the notes when it's forgotten.
const ROUNDS = 600000
const MARK = 'bob1:'
export const PIN_MIN = 6
export const LOCKED_TITLE = 'Locked note'

const enc = new TextEncoder()
const dec = new TextDecoder()
const random = (n) => crypto.getRandomValues(new Uint8Array(n))
const toB64 = (bytes) => {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s)
}
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function pinKey(pin, salt, rounds) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
const groupKey = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
const lockTag = (groupId, kid) => enc.encode(`bob-lock:${groupId}:${kid}`)
const noteTag = (groupId, noteId) => enc.encode(`bob-note:${groupId}:${noteId}`)

async function wrap(raw, pin, groupId, kid) {
  const salt = random(16)
  const iv = random(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: lockTag(groupId, kid) }, await pinKey(pin, salt, ROUNDS), raw)
  return { v: 1, kid, rounds: ROUNDS, salt: toB64(salt), iv: toB64(iv), data: toB64(data) }
}

// The raw key, or null when the PIN is wrong
async function unwrap(lock, pin, groupId) {
  const key = await pinKey(pin, fromB64(lock.salt), lock.rounds)
  try {
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(lock.iv), additionalData: lockTag(groupId, lock.kid) }, key, fromB64(lock.data))
  } catch { return null }
}

export async function makeLock(pin, groupId) {
  const raw = random(32)
  return { lock: await wrap(raw, pin, groupId, crypto.randomUUID()), key: await groupKey(raw) }
}

// The key to the notes, or null when the PIN is wrong
export async function openLock(lock, pin, groupId) {
  const raw = await unwrap(lock, pin, groupId)
  return raw && groupKey(raw)
}

// The same key under a new PIN (the notes stay as they are), or null when the old PIN is wrong
export async function changeLock(lock, oldPin, newPin, groupId) {
  const raw = await unwrap(lock, oldPin, groupId)
  return raw && wrap(raw, newPin, groupId, lock.kid)
}

export const isSealed = (note) => note.body.startsWith(MARK)

// A note as the database gets it. The name is inside too, and the group and note ids are tied to it.
// Which lock it belongs to stands in front, so the database can refuse a note for a lock that's gone (SQL 10).
export async function seal(key, group, noteId, { title, body }) {
  const iv = random(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: noteTag(group.id, noteId) }, key, enc.encode(JSON.stringify({ title, body })))
  return { title: LOCKED_TITLE, body: `${MARK}${group.lock.kid}:${toB64(iv)}:${toB64(data)}` }
}

// { title, body }, or throws when it can't be opened
export async function unseal(key, groupId, noteId, text) {
  const [, iv, data] = text.slice(MARK.length).split(':')
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv), additionalData: noteTag(groupId, noteId) }, key, fromB64(data))))
}
