import { supabase } from './supabase'
import { signedIn } from './session'

// Every change to tasks goes through this queue. It is sent right away when there's a connection;
// otherwise it waits on this device, in order, and is sent later.
//   { table, type: 'insert', row } | { table, type: 'upsert', row, onConflict }
//   { table, type: 'update', match, fields } | { table, type: 'delete', match }
// All of them can safely be sent twice.
const PATIENCE = 1500 // how long the screen waits for an answer before carrying on
const TIMEOUT = 15000
const RETRY = 30000

let user = null
let state = { pending: 0, stuck: false } // stuck = the last try didn't get through
let running = null
let sent = 0
let timer = null
const stateListeners = new Set()
const rejectListeners = new Set()
const left = new Set() // changes the screen stopped waiting for
const refused = new Map()

const key = () => `bob-outbox-${user}`
function read() { try { return JSON.parse(localStorage.getItem(key())) ?? [] } catch { return memory } }
let memory = []
function store(ops) {
  memory = ops
  try { localStorage.setItem(key(), JSON.stringify(ops)) } catch { /* only in memory then */ }
}
function setState(next) {
  if (next.pending === state.pending && next.stuck === state.stuck) return
  state = next
  stateListeners.forEach((l) => l())
}

async function send(op) {
  const t = supabase.from(op.table)
  const q = op.type === 'insert' ? t.insert(op.row)
    : op.type === 'upsert' ? t.upsert(op.row, { onConflict: op.onConflict, ignoreDuplicates: true })
      : op.type === 'update' ? t.update(op.fields).match(op.match)
        : t.delete().match(op.match)
  const { error, status } = await q.abortSignal(AbortSignal.timeout(TIMEOUT))
  if (!error || error.code === '23505') return 'sent' // 23505: it was already there
  // No answer, not signed in, too busy or a server problem: try again later. Anything else won't get better.
  if (!status || status === 401 || status === 408 || status === 429 || status >= 500) return 'later'
  return error
}

async function work() {
  while (read().length) {
    if (!await signedIn(user)) return setState({ pending: read().length, stuck: true })
    const op = read()[0]
    if (!op) break
    const answer = await send(op).catch(() => 'later')
    if (answer === 'later') return setState({ pending: read().length, stuck: true })
    sent++
    store(read().filter((o) => o.id !== op.id))
    if (answer !== 'sent') {
      refused.set(op.id, answer)
      // Nobody is waiting for this one any more: tell the screen afterwards
      if (left.has(op.id)) rejectListeners.forEach((l) => l(op, answer))
    }
    left.delete(op.id)
    setState({ pending: read().length, stuck: false })
  }
  setState({ pending: 0, stuck: false })
}

// Send what's waiting. One at a time, also across two open windows.
export function flush() {
  if (!user || !read().length) return Promise.resolve()
  running ??= (navigator.locks ? navigator.locks.request('bob-outbox', work) : work())
    .catch(() => {})
    .finally(() => {
      running = null
      clearTimeout(timer)
      if (read().length) timer = setTimeout(flush, RETRY)
    })
  return running
}

// Answers { ok: true }, { queued: true } when it waits for a connection, or { error } when the server said no
export async function write(op) {
  const item = { ...op, id: crypto.randomUUID() }
  store([...read(), item])
  setState({ ...state, pending: read().length })
  const waiting = () => read().some((o) => o.id === item.id)
  if (navigator.onLine === false) {
    left.add(item.id)
    setState({ pending: read().length, stuck: true })
    return { queued: true }
  }
  const sent = flush().then(() => (waiting() && !state.stuck ? flush() : undefined))
  await Promise.race([sent, new Promise((r) => setTimeout(r, PATIENCE))])
  if (waiting()) { left.add(item.id); return { queued: true } }
  if (refused.has(item.id)) {
    const error = refused.get(item.id)
    refused.delete(item.id)
    return { error }
  }
  return { ok: true }
}

// What the server answered, with the changes that haven't reached it yet put on top
export function withPending(table, rows) {
  const hit = (row, match) => Object.entries(match).every(([k, v]) => row[k] === v)
  return read().filter((op) => op.table === table).reduce((all, op) => {
    if (op.type === 'update') return all.map((r) => (hit(r, op.match) ? { ...r, ...op.fields } : r))
    if (op.type === 'delete') return all.filter((r) => !hit(r, op.match))
    const id = op.type === 'upsert' ? Object.fromEntries(op.onConflict.split(',').map((k) => [k, op.row[k]])) : { id: op.row.id }
    return all.some((r) => hit(r, id)) ? all : [...all, op.row]
  }, rows)
}

export function startOutbox(userId) {
  user = userId
  setState({ pending: read().length, stuck: false })
  const go = () => { flush() }
  const onVisible = () => { if (document.visibilityState === 'visible') flush() }
  window.addEventListener('online', go)
  document.addEventListener('visibilitychange', onVisible)
  flush()
  return () => {
    window.removeEventListener('online', go)
    document.removeEventListener('visibilitychange', onVisible)
    clearTimeout(timer)
    if (user === userId) user = null
  }
}

export const outboxState = () => state
// Goes up with every change that was sent. If it moved during a fetch, that answer may be older than the change.
export const sentCount = () => sent
export function onOutbox(listener) { stateListeners.add(listener); return () => stateListeners.delete(listener) }
export function onRefused(listener) { rejectListeners.add(listener); return () => rejectListeners.delete(listener) }
// Signing out on purpose, after being asked
export function dropOutbox() { store([]); setState({ pending: 0, stuck: false }) }
