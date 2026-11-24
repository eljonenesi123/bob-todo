import { addDays } from '../lib/dates'
import { daysUntil } from '../lib/countdown'
import { between } from '../lib/calendar'
import './OnDay.css'

const SHOWN = 2

// One quiet line on Today for each calendar entry of the picked day, and for what starts tomorrow
export default function OnDay({ calendar, day, today, onOpen }) {
  const now = between(calendar.entries, [], day, day)
  const next = day === today ? between(calendar.entries, [], addDays(today, 1), addDays(today, 1)).filter((o) => o.start > today) : []
  const list = [...next.filter((o) => o.entry.highlight), ...now, ...next.filter((o) => !o.entry.highlight)]
  if (!list.length) return null

  function text(o) {
    const { title, at_time, highlight } = o.entry
    const several = o.start !== o.end
    const time = at_time ? ` at ${at_time.slice(0, 5)}` : ''
    const strong = (label) => (highlight ? <span className="on-day-mark">{label}</span> : <strong>{label}</strong>)
    if (o.start > day) return strong(`${title} ${several ? 'starts' : 'is'} tomorrow${time}`)
    if (several && o.start === day) return strong(`${title} starts${day === today ? ' today' : ''}`)
    if (several && o.end === day) return <><strong>{title}</strong> last day</>
    if (several) return <><strong>{title}</strong> day {daysUntil(day, o.start) + 1} of {daysUntil(o.end, o.start) + 1}</>
    return highlight && day === today ? strong(`${title}${time || ' today'}`) : <><strong>{title}</strong>{time || (day === today ? ' today' : '')}</>
  }

  return (
    <button type="button" className="on-day" onClick={() => onOpen(list[0].start > day ? list[0].start : day)}>
      {list.slice(0, SHOWN).map((o) => <span key={`${o.entry.id}-${o.start}`} className="on-day-line">{text(o)}</span>)}
      {list.length > SHOWN && <span className="on-day-line">and {list.length - SHOWN} more in the calendar</span>}
    </button>
  )
}
