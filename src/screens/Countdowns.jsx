import { useState } from 'react'
import { useTaskData } from '../context/tasks'
import { daysUntil, longDate, checkInDay, checkInDue } from '../lib/countdown'
import CountdownSheet from '../components/CountdownSheet'

const PAST_SHOWN = 5

// What to say about checking in, or nothing
function checkInText(c, today) {
  if (!c.is_trip || c.on_date < today) return ''
  if (c.checked_in_at) return 'Checked in online'
  if (!c.checkin_at) return ''
  if (checkInDue(c, today)) return 'Time to check in online'
  return `Check-in reminder ${longDate(checkInDay(c), today)} at ${c.checkin_at.slice(0, 5)}`
}

export default function Countdowns({ userId, countdowns, partner, partnerName }) {
  const { today } = useTaskData()
  const [sheet, setSheet] = useState(null) // { item } while the sheet is open; item is empty for a new one
  const [error, setError] = useState('')
  const { items, loading, failed } = countdowns
  const ahead = items.filter((c) => c.on_date >= today)
  const past = items.filter((c) => c.on_date < today).reverse().slice(0, PAST_SHOWN)

  async function checkedIn(c) {
    setError('')
    try {
      await countdowns.update(c, { checked_in_at: new Date().toISOString() })
    } catch {
      setError('That wasn’t saved. Check your connection and try again.')
    }
  }

  return (
    <section className="pad" aria-label="Countdowns">
      <div className="new-row">
        <span className="row-margin"><span className="pen" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span></span>
        <button type="button" className="ink-btn" onClick={() => setSheet({})}>New countdown</button>
      </div>
      {error && <p className="pad-note error" role="alert">{error}</p>}

      {loading ? (
        <div className="pad-loading" aria-label="Loading" />
      ) : failed ? (
        <div className="blank">
          <p className="blank-title">Your countdowns didn’t open.</p>
          <p className="blank-sub">Check your connection and try again.</p>
          <div className="pad-block"><button type="button" className="ink-btn" onClick={countdowns.reload}>Try again</button></div>
        </div>
      ) : ahead.length === 0 ? (
        <div className="blank">
          <p className="blank-title">Nothing to count down to.</p>
          <p className="blank-sub">Add a trip, a birthday or any day you’re looking forward to. For trips, Bob reminds you to check in online the day before.</p>
        </div>
      ) : (
        <ul className="ruled">
          {ahead.map((c) => {
            const days = daysUntil(c.on_date, today)
            const note = checkInText(c, today)
            return (
              <li key={c.id} className="pad-line count-line">
                <button type="button" className="count-open" onClick={() => setSheet({ item: c })}>
                  <span className="row-margin count-days" aria-hidden="true">
                    {days === 0 ? <strong className="count-today">Today</strong> : <><strong>{days}</strong>{days === 1 ? 'day' : 'days'}</>}
                  </span>
                  <span className="line-body">
                    <span className="sr-only">{days === 0 ? 'Today: ' : `In ${days} ${days === 1 ? 'day' : 'days'}: `}</span>
                    <span className="line-title">{c.title}</span>
                    <span className="line-sub">{longDate(c.on_date, today)}</span>
                    {c.shared_with && <span className="line-sub">{c.user_id === userId ? `Shared with ${partnerName || 'your person'}` : `Shared by ${partnerName || 'your person'}`}</span>}
                    {note && <span className="line-sub"><span className={checkInDue(c, today) ? 'hl-static check-due' : ''}>{note}</span></span>}
                  </span>
                </button>
                {checkInDue(c, today) && (
                  <span className="line-end"><button type="button" className="ink-btn" onClick={() => checkedIn(c)}>Done</button></span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {past.length > 0 && (
        <section className="pad-section past">
          <h2 className="pad-h">Past</h2>
          <ul className="ruled">
            {past.map((c) => (
              <li key={c.id}>
                <button type="button" className="pad-line" onClick={() => setSheet({ item: c })}>
                  <span className="row-margin" />
                  <span className="line-body">
                    <span className="line-title">{c.title}</span>
                    <span className="line-sub">{longDate(c.on_date, today)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CountdownSheet open={!!sheet} item={sheet?.item} onClose={() => setSheet(null)} countdowns={countdowns}
        userId={userId} partner={partner} partnerName={partnerName} today={today} />
    </section>
  )
}
