import { useEffect, useState, useSyncExternalStore } from 'react'
import { createDraft } from '../lib/pageDraft'

const STATUS = { writing: 'Saving…', saved: 'Saved', error: 'Not saved yet, still trying' }

const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path className="tick" d="M5 12.5l4.5 4.5L19 7" /></svg>
)

// One open page of the notebook. `page` is empty for a new one; it is saved with the first words.
export default function PageEditor({ userId, kind, page: opened, notebook, partner, partnerName, onClose }) {
  const [store] = useState(() => createDraft({ userId, kind, page: opened, save: notebook.savePage }))
  const draft = useSyncExternalStore(store.subscribe, store.get)
  const page = notebook.pages.find((p) => p.id === draft.id)
  const items = notebook.items.filter((i) => i.page_id === draft.id)
  const lines = [...items.filter((i) => !i.done_at), ...items.filter((i) => i.done_at)]
  const [line, setLine] = useState('')
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  const [error, setError] = useState('')
  const mine = !page || page.user_id === userId

  useEffect(() => { if (page) store.adopt(page) }, [store, page])
  useEffect(() => {
    window.scrollTo(0, 0)
    store.flush()
    const onHide = () => { if (document.visibilityState === 'hidden') store.flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      store.close()
    }
  }, [store])

  // Runs something that answers true when it worked
  async function run(action) {
    setBusy(true)
    setError('')
    const ok = await action().catch(() => false)
    setBusy(false)
    if (!ok) setError('That didn’t work. Check your connection and try again.')
    return ok
  }

  async function addLine(e) {
    e.preventDefault()
    const title = line.trim()
    if (!title || busy) return
    const position = items.reduce((max, i) => Math.max(max, i.position), 0) + 1
    if (await run(async () => await store.ensure() && notebook.addItem(store.get().id, title, position))) setLine('')
  }

  async function remove() {
    if (!sure) return setSure(true)
    if (await run(() => notebook.removePage(page))) {
      store.discard()
      onClose()
    } else setSure(false)
  }

  return (
    <main className="paper-page tab-screen notebook">
      <header className="desk-head page-head">
        <h1 className="sr-only">{kind === 'list' ? 'List' : 'Page'}</h1>
        <button type="button" className="back-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          Notebook
        </button>
        <span className="save-status" role="status">{STATUS[draft.status]}</span>
      </header>

      <section className="pad" aria-label={kind === 'list' ? 'Your list' : 'Your page'}>
        {draft.status === 'conflict' && (
          <div className="pad-block page-notice" role="alert">
            <p>This page was also changed on another device. Which one do you want to keep?</p>
            <p className="theirs">{[draft.theirs.title, draft.theirs.body].filter(Boolean).join(': ') || 'The other one is empty.'}</p>
            <div className="sheet-more">
              <button type="button" className="ink-btn" onClick={store.keepMine}>Keep mine</button>
              <button type="button" className="ink-btn" onClick={store.useTheirs}>Use the other one</button>
            </div>
          </div>
        )}
        {draft.status === 'gone' && (
          <div className="pad-block page-notice" role="alert">
            <p>This page was deleted somewhere else. Your words are still here.</p>
            <button type="button" className="ink-btn" onClick={store.saveAsNew}>Save as a new page</button>
          </div>
        )}

        <div className="pad-block">
          <input className="line-input big-input" aria-label="Title" maxLength={120} autoFocus={!opened}
            placeholder={kind === 'list' ? 'Name of the list' : 'Title'}
            value={draft.title} onChange={(e) => store.change({ title: e.target.value })} onBlur={store.flush} />
        </div>

        {kind === 'note' ? (
          <div className="grow" data-value={draft.body}>
            <textarea aria-label="Your writing" maxLength={20000} placeholder="Write anything"
              value={draft.body} onChange={(e) => store.change({ body: e.target.value })} onBlur={store.flush} />
          </div>
        ) : (
          <>
            <ul className="ruled page-lines">
              {lines.map((i) => (
                <li key={i.id} className={`page-line ${i.done_at ? 'is-done' : ''}`}>
                  <button type="button" role="checkbox" aria-checked={!!i.done_at} className="line-toggle" onClick={() => run(() => notebook.toggleItem(i))}>
                    <span className="row-margin"><span className={`box ${i.done_at ? 'is-checked' : ''}`}><Tick /></span></span>
                    <span className="page-line-text"><span>{i.title}</span></span>
                  </button>
                  <button type="button" className="line-x" aria-label={`Remove ${i.title}`} onClick={() => run(() => notebook.removeItem(i))}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            <form className="line-add" onSubmit={addLine}>
              <span className="row-margin"><span className="pen" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span></span>
              <input aria-label="New line" placeholder="Add a line" maxLength={200} enterKeyHint="done"
                value={line} onChange={(e) => setLine(e.target.value)} />
              {line.trim() && <button className="ink-btn" disabled={busy}>Add</button>}
            </form>
          </>
        )}

        {error && <p className="pad-note error" role="alert">{error}</p>}

        {page && (
          <div className="pad-block page-actions">
            <button type="button" className="ink-btn" disabled={busy} aria-pressed={page.pinned}
              onClick={() => run(() => notebook.setPage(page, { pinned: !page.pinned }))}>{page.pinned ? 'Unpin' : 'Pin to top'}</button>
            {mine && partner && (
              <button type="button" className="ink-btn" disabled={busy} aria-pressed={!!page.shared_with}
                onClick={() => run(() => notebook.setPage(page, { shared_with: page.shared_with ? null : partner.id }))}>
                {page.shared_with ? 'Stop sharing' : `Share with ${partnerName || 'my person'}`}
              </button>
            )}
            {mine && (
              <button type="button" className="ink-btn danger" disabled={busy} onClick={remove} onBlur={() => setSure(false)}>
                {sure ? 'Tap again to delete' : 'Delete'}
              </button>
            )}
          </div>
        )}
        {page?.shared_with && (
          <p className="pad-note">{mine ? `${partnerName || 'Your person'} can read and change this.` : `Shared by ${partnerName || 'your person'}.`}</p>
        )}
      </section>
    </main>
  )
}
