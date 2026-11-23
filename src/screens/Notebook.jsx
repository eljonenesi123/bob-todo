import { useState } from 'react'
import { hasUnsavedNew } from '../lib/pageDraft'
import PageEditor from './PageEditor'
import Countdowns from './Countdowns'
import './Notebook.css'

const SEARCH_FROM = 8 // searching only helps once there are this many pages

const PageIcon = ({ kind }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'list'
      ? <><path d="M4 7l1.5 1.5L8 5.5M4 16l1.5 1.5L8 14.5" /><path d="M12 7h8M12 16h8" /></>
      : <><path d="M6 3h8l4 4v14H6z" /><path d="M9 11h6M9 15h6" /></>}
  </svg>
)

function preview(page, items) {
  if (page.kind === 'note') return page.body.trim().split('\n')[0]
  const all = items.filter((i) => i.page_id === page.id)
  const left = all.filter((i) => !i.done_at).length
  if (all.length === 0) return 'Empty list'
  return left === 0 ? 'All done' : `${left} left`
}

const byUse = (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)

export default function Notebook({ userId, notebook, countdowns, partner, partnerName, view, onView }) {
  const [open, setOpen] = useState(null) // { kind, page } while a page is open
  const [find, setFind] = useState('')

  if (open) {
    return <PageEditor userId={userId} kind={open.kind} page={open.page} notebook={notebook}
      partner={partner} partnerName={partnerName} onClose={() => { setOpen(null); window.scrollTo(0, 0) }} />
  }

  const { pages, items, loading, failed } = notebook
  const words = find.trim().toLowerCase()
  const matches = (p) => !words || [p.title, p.body, ...items.filter((i) => i.page_id === p.id).map((i) => i.title)]
    .some((t) => t.toLowerCase().includes(words))
  const shown = pages.filter(matches).sort(byUse)

  return (
    <main className="paper-page tab-screen notebook">
      <header className="desk-head">
        <h1 className="page-title">Notebook</h1>
        <div className="pills notes-switch" role="group" aria-label="Notebook">
          <button type="button" className={`pill ${view === 'pages' ? 'is-on' : ''}`} aria-pressed={view === 'pages'} onClick={() => onView('pages')}>Pages</button>
          <button type="button" className={`pill ${view === 'countdowns' ? 'is-on' : ''}`} aria-pressed={view === 'countdowns'} onClick={() => onView('countdowns')}>Countdowns</button>
        </div>
      </header>

      {view === 'countdowns' ? (
        <Countdowns userId={userId} countdowns={countdowns} partner={partner} partnerName={partnerName} />
      ) : (
        <section className="pad" aria-label="Your pages">
          <div className="new-row">
            <span className="row-margin"><span className="pen" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span></span>
            <button type="button" className="ink-btn" onClick={() => setOpen({ kind: 'note' })}>{hasUnsavedNew(userId, 'note') ? 'Unsaved page' : 'New page'}</button>
            <button type="button" className="ink-btn" onClick={() => setOpen({ kind: 'list' })}>{hasUnsavedNew(userId, 'list') ? 'Unsaved list' : 'New list'}</button>
          </div>

          {pages.length >= SEARCH_FROM && (
            <div className="pad-block find">
              <input type="search" className="line-input" aria-label="Find a page" placeholder="Find a page" value={find} onChange={(e) => setFind(e.target.value)} />
            </div>
          )}

          {loading ? (
            <div className="pad-loading" aria-label="Loading" />
          ) : failed ? (
            <div className="blank">
              <p className="blank-title">Your notebook didn’t open.</p>
              <p className="blank-sub">Check your connection and try again.</p>
              <div className="pad-block"><button type="button" className="ink-btn" onClick={notebook.reload}>Try again</button></div>
            </div>
          ) : pages.length === 0 ? (
            <div className="blank">
              <p className="blank-title">Nothing written yet.</p>
              <p className="blank-sub">Keep a thought on a page, or start a list for shopping or packing. Only you see it, unless you share it.</p>
            </div>
          ) : (
            <ul className="ruled">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className="pad-line" onClick={() => setOpen({ kind: p.kind, page: p })}>
                    <span className="row-margin"><PageIcon kind={p.kind} /></span>
                    <span className="line-body">
                      <span className="line-title">{p.title.trim() || 'Untitled'}</span>
                      <span className="line-sub one-line">
                        {preview(p, items)}
                      </span>
                      {p.shared_with && <span className="line-sub">{p.user_id === userId ? `Shared with ${partnerName || 'your person'}` : `Shared by ${partnerName || 'your person'}`}</span>}
                    </span>
                    {p.pinned && (
                      <span className="line-end pin">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Pinned"><path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v6" /></svg>
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="pad-line"><span className="row-margin" /><span className="line-body">No page with “{find.trim()}”.</span></li>}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
