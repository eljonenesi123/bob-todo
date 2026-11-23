// The writing on one open notebook page. Saves by itself shortly after the last key,
// keeps a copy on this device until the server has it (so nothing is lost offline),
// and never silently overwrites a version written somewhere else.
const WAIT = 700
const RETRY = 5000

const keyOf = (userId, name) => `bob-page-${userId}-${name}`
function read(key) { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ } }
function clear(key) { try { localStorage.removeItem(key) } catch { /* ignore */ } }

export const hasUnsavedNew = (userId, kind) => !!read(keyOf(userId, `new-${kind}`))

// status: 'idle' | 'writing' | 'saved' | 'error' | 'conflict' | 'gone'
export function createDraft({ userId, kind, page, save }) {
  const kept = read(keyOf(userId, page ? page.id : `new-${kind}`))
  const start = page
    ? { id: page.id, title: page.title, body: page.body, base: page.updated_at }
    : { id: crypto.randomUUID(), title: '', body: '', base: null }
  // A copy that never reached the server: go on from there
  const unsaved = !!kept && (kept.title !== start.title || kept.body !== start.body)
  let state = { ...(unsaved ? kept : start), status: unsaved ? 'writing' : 'idle', theirs: null }
  let dirty = unsaved
  let saving = null
  let timer = null
  const listeners = new Set()

  const key = () => keyOf(userId, state.base ? state.id : `new-${kind}`)
  const set = (fields) => { state = { ...state, ...fields }; listeners.forEach((l) => l()) }
  const keep = () => write(key(), { id: state.id, title: state.title, body: state.body, base: state.base })
  const plan = (ms) => { clearTimeout(timer); timer = setTimeout(flush, ms) }

  async function saveNow() {
    while (dirty) {
      const sent = { id: state.id, kind, title: state.title, body: state.body, base: state.base }
      const oldKey = key()
      dirty = false
      const res = await save(sent).catch((error) => ({ error }))
      if (res.row) {
        clear(oldKey)
        set({ base: res.row.updated_at, status: dirty ? 'writing' : 'saved' })
        if (dirty) keep()
        continue
      }
      dirty = true
      if (res.conflict) set({ status: 'conflict', theirs: res.conflict })
      else if (res.gone) set({ status: 'gone' })
      else { set({ status: 'error' }); plan(RETRY) }
      return
    }
  }

  // Save whatever isn't saved yet
  function flush() {
    clearTimeout(timer)
    if (!dirty || state.status === 'conflict' || state.status === 'gone') return saving ?? Promise.resolve()
    saving ??= saveNow().finally(() => { saving = null })
    return saving
  }

  return {
    subscribe(l) { listeners.add(l); return () => listeners.delete(l) },
    get: () => state,
    change(fields) {
      const blocked = state.status === 'conflict' || state.status === 'gone'
      dirty = true
      set({ ...fields, ...(blocked ? {} : { status: 'writing' }) })
      keep()
      if (!blocked) plan(WAIT)
    },
    // A newer version arrived from another device and nothing here is waiting to be saved
    adopt(row) {
      if (dirty || saving || !state.base || row.updated_at <= state.base) return
      set({ title: row.title, body: row.body, base: row.updated_at })
    },
    keepMine() { set({ base: state.theirs.updated_at, theirs: null, status: 'writing' }); keep(); return flush() },
    useTheirs() {
      const t = state.theirs
      clearTimeout(timer)
      dirty = false
      clear(key())
      set({ title: t.title, body: t.body, base: t.updated_at, theirs: null, status: 'saved' })
    },
    saveAsNew() {
      clear(key())
      set({ id: crypto.randomUUID(), base: null, status: 'writing' })
      keep()
      return flush()
    },
    // Make sure the page exists on the server (before adding lines to a list). True when it does.
    async ensure() {
      if (!state.base) { dirty = true; keep() }
      await flush()
      return !!state.base
    },
    // Throw the writing away (the page is being deleted)
    discard() { clearTimeout(timer); dirty = false; clear(key()) },
    // Closing the page: save what's left, stop retrying
    close() { return flush().then(() => clearTimeout(timer)) },
    flush,
  }
}
