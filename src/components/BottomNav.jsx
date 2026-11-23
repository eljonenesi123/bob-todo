const ICONS = {
  today: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  notebook: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M13 8h3" /></>,
  notes: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 8l9 6 9-6" /></>,
  nudges: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
}

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'notes', label: 'Letters' },
  { id: 'nudges', label: 'Nudges' },
]

export default function BottomNav({ tab, onChange, notesDot, nudgesDot }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="bottom-nav-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`nav-btn ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            <span className="nav-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[t.id]}
              </svg>
              {t.id === 'notes' && notesDot && <span className="nav-dot" aria-label="New" />}
              {t.id === 'nudges' && nudgesDot && <span className="nav-dot" aria-label="Needs attention" />}
            </span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
