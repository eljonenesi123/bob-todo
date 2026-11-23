import { useState } from 'react'
import { daysUntil, inWords, checkInDue, nextUp } from '../lib/countdown'
import './NextUp.css'

// One line on Today: the nearest countdown, or a check-in to do
export default function NextUp({ countdowns, today, onOpen }) {
  const [failed, setFailed] = useState(false)
  const c = nextUp(countdowns.items, today)
  if (!c) return null
  const when = inWords(daysUntil(c.on_date, today))
  const due = checkInDue(c, today)

  async function done() {
    setFailed(false)
    try {
      await countdowns.update(c, { checked_in_at: new Date().toISOString() })
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="next-up">
      <button type="button" className="next-up-open" onClick={onOpen}>
        {due
          ? <><strong>{c.title} is {when}</strong> <span className="next-up-mark">Check in online</span></>
          : <span><strong>{c.title}</strong> {when}</span>}
      </button>
      {due && <button type="button" className="next-up-done" onClick={done} aria-label={`Checked in for ${c.title}`}>Done</button>}
      {failed && <p className="error" role="alert">That wasn’t saved. Check your connection and try again.</p>}
    </div>
  )
}
