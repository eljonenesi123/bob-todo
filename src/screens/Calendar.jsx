import { useMemo, useState } from 'react'
import { useTaskData } from '../context/tasks'
import { addDays } from '../lib/dates'
import { daysUntil, inWords } from '../lib/countdown'
import { between, weeksOf, layoutWeek, monthOf, addMonths, dayText, spanText, onDayText } from '../lib/calendar'
import BackButton from '../components/BackButton'
import CalendarSheet from '../components/CalendarSheet'
import CountdownSheet from '../components/CountdownSheet'
import TaskMenu from '../components/TaskMenu'
import './Calendar.css'

const LINES = 2 // bars on top of each other in one week
const NAMED = 3 // shorter bars have no room for their name
const AHEAD = 120
const COMING = 4
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const words = (iso, options) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', options)
const keyOf = (o) => `${o.entry.id}-${o.start}`

const Chevron = ({ back }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
)

export default function Calendar({ userId, calendar, countdowns, partner, partnerName, day, onDay, onNotice, onClose }) {
  const { today, planFor } = useTaskData()
  const [month, setMonth] = useState(() => monthOf(day))
  const [sheet, setSheet] = useState(null)
  const [menu, setMenu] = useState(null) // one time of a repeating entry: what to do with it
  const [countdown, setCountdown] = useState(null)
  const { entries, loading, failed } = calendar

  const kind = (o) => (o.countdown ? 'is-countdown' : o.entry.user_id !== userId ? 'is-theirs' : o.entry.highlight ? 'is-hl' : '')

  const weeks = useMemo(() => weeksOf(month).map((monday) => ({
    monday,
    list: between(entries, countdowns.items, monday, addDays(monday, 6)),
  })), [month, entries, countdowns.items])
  const onDayList = useMemo(() => between(entries, countdowns.items, day, day), [entries, countdowns.items, day])
  const coming = useMemo(() => between(entries, countdowns.items, addDays(day, 1), addDays(day, AHEAD)).filter((o) => o.start > day).slice(0, COMING), [entries, countdowns.items, day])
  const tasks = day >= today ? planFor(day) : []

  function pick(iso) {
    onDay(iso)
    setMonth(monthOf(iso))
  }
  function turn(by) {
    const next = addMonths(month, by)
    setMonth(next)
    onDay(monthOf(today) === next ? today : next)
  }

  function open(o) {
    if (o.countdown) return setCountdown(o.entry)
    if (o.entry.repeat === 'never') return setSheet({ mode: 'all', ...o })
    setMenu(o)
  }
  const copy = (entry) => setSheet({ mode: 'new', entry, day })

  // Deleting, skipping and stopping all offer a way back
  async function withUndo(text, action, undo) {
    try {
      await action()
    } catch {
      return onNotice({ text: 'That wasn’t saved. Check your connection and try again.' })
    }
    const back = () => undo().catch(() => onNotice({ text: 'It didn’t come back. Check your connection and try again.', undo: back }))
    onNotice({ text, undo: back })
  }
  const remove = (entry) => withUndo(`Deleted “${entry.title}”`, () => calendar.remove(entry), () => calendar.restore(entry))
  const skip = ({ entry, start }) => withUndo(`Skipped “${entry.title}” on ${dayText(start, today)}`,
    () => calendar.update(entry, { skipped: [...entry.skipped, start] }),
    () => calendar.update(entry, { skipped: entry.skipped }))
  const stop = ({ entry, start }) => withUndo(`“${entry.title}” stops before ${dayText(start, today)}`,
    () => calendar.update(entry, { until: addDays(start, -1) }),
    () => calendar.update(entry, { until: entry.until }))

  const menuTask = menu && { id: keyOf(menu), title: `${menu.entry.title}, ${spanText(menu, today)}` }
  const menuActions = menu ? [
    { label: 'Change only this one', run: () => setSheet({ mode: 'one', ...menu }) },
    { label: 'Change all of them', run: () => setSheet({ mode: 'all', ...menu }) },
    { label: 'Add another', run: () => copy(menu.entry) },
    { label: 'Skip this one', run: () => skip(menu) },
    menu.start > menu.entry.starts_on && { label: 'Stop from this one on', danger: true, run: () => stop(menu) },
    { label: 'Delete all of them', danger: true, run: () => remove(menu.entry) },
  ].filter(Boolean) : []

  function line(o, sub, onClick) {
    const shared = o.entry.shared_with
      ? (o.entry.user_id === userId ? `Shared with ${partnerName || 'your person'}` : `Shared by ${partnerName || 'your person'}`) : ''
    const content = (
      <>
        <span className="row-margin"><span className={`cal-swatch ${kind(o)}`} aria-hidden="true" /></span>
        <span className="line-body">
          <span className="line-title">{o.entry.title}</span>
          <span className="line-sub">{sub}</span>
          {shared && <span className="line-sub">{shared}</span>}
        </span>
      </>
    )
    return (
      <li key={keyOf(o)}>
        {onClick ? <button type="button" className="pad-line" onClick={onClick}>{content}</button> : <div className="pad-line">{content}</div>}
      </li>
    )
  }
  const mine = (o) => o.countdown || o.entry.user_id === userId
  const thisMonth = month === monthOf(today)

  return (
    <main className="paper-page tab-screen notebook calendar">
      <h1 className="sr-only">Calendar</h1>
      <div className="desk-head page-head">
        <BackButton label="Today" onClick={onClose} />
        {(!thisMonth || day !== today) && <button type="button" className="desk-btn" onClick={() => pick(today)}>Go to today</button>}
      </div>
      <header className="cal-top">
        <h2 aria-live="polite">{words(month, { month: 'long' })} <span>{month.slice(0, 4)}</span></h2>
        <div className="cal-arrows">
          <button type="button" aria-label="Previous month" onClick={() => turn(-1)}><Chevron back /></button>
          <button type="button" aria-label="Next month" onClick={() => turn(1)}><Chevron /></button>
        </div>
      </header>

      <section className="cal-card" aria-label={words(month, { month: 'long', year: 'numeric' })}>
        <div className="cal-week-names" aria-hidden="true">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
        {weeks.map(({ monday, list }) => {
          const { bars, more } = layoutWeek(monday, list, LINES)
          return (
            <div key={monday} className="cal-week">
              {DOW.map((d, i) => {
                const iso = addDays(monday, i)
                const names = list.filter((o) => o.start <= iso && o.end >= iso).map((o) => o.entry.title)
                return (
                  <button key={iso} type="button" style={{ gridColumn: i + 1 }} aria-pressed={iso === day} aria-current={iso === today ? 'date' : undefined}
                    aria-label={`${words(iso, { weekday: 'long', day: 'numeric', month: 'long' })}${names.length ? `: ${names.join(', ')}` : ''}`}
                    className={`cal-cell ${monthOf(iso) === month ? '' : 'is-out'} ${iso === today ? 'is-today' : ''} ${iso === day ? 'is-picked' : ''}`}
                    onClick={() => pick(iso)}>
                    <span>{Number(iso.slice(8))}</span>
                  </button>
                )
              })}
              {bars.map((b) => (
                <span key={keyOf(b)} aria-hidden="true" style={{ gridColumn: `${b.a + 1} / ${b.z + 2}`, gridRow: b.line + 2 }}
                  className={`cal-bar ${kind(b)} ${b.start === b.end ? 'is-dot' : ''} ${b.before ? 'goes-before' : ''} ${b.after ? 'goes-after' : ''}`}>
                  {b.z - b.a + 1 >= NAMED && b.entry.title}
                </span>
              ))}
              {more.map((n, i) => n > 0 && (
                <span key={i} className="cal-more" aria-hidden="true" style={{ gridColumn: i + 1, gridRow: LINES + 2 }}>+{n}</span>
              ))}
            </div>
          )
        })}
      </section>

      <section className="pad" aria-label="What’s on">
        <section className="pad-section">
          <h2 className="pad-h">{words(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          {onDayList.length > 0 && (
            <ul className="notes-list cal-list">
              {onDayList.map((o) => line(o, onDayText(o, day, today), mine(o) ? () => open(o) : null))}
            </ul>
          )}
          {tasks.length > 0 && (
            <div className="pad-line cal-tasks">
              <span className="line-body">
                <span className="line-sub">{tasks.length === 1 ? '1 task planned' : `${tasks.length} tasks planned`}</span>
                {tasks.map((t) => <span key={t.id} className={t.done ? 'cal-task is-done' : 'cal-task'}>{t.title}{t.done && <span className="sr-only"> (done)</span>}</span>)}
              </span>
            </div>
          )}

          {loading ? (
            <div className="pad-loading" aria-label="Loading" />
          ) : failed ? (
            <div className="blank">
              <p className="blank-title">Your calendar didn’t open.</p>
              <p className="blank-sub">Check your connection and try again.</p>
              <div className="pad-block"><button type="button" className="ink-btn" onClick={calendar.reload}>Try again</button></div>
            </div>
          ) : (
            <>
              {entries.length === 0
                ? <p className="pad-note">Put in what has its own days: a standby week, shifts, birthdays, appointments. Bob reminds you before it starts.</p>
                : onDayList.length === 0 && tasks.length === 0 && <p className="pad-note">Nothing on this day.</p>}
              <button type="button" className="write-row" onClick={() => setSheet({ mode: 'new', day })}>
                <span className="row-margin"><span className="pen" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span></span>
                <span>Add to calendar</span>
              </button>
            </>
          )}
        </section>

        {coming.length > 0 && (
          <section className="pad-section">
            <h2 className="pad-h">Coming up</h2>
            <ul className="notes-list">
              {coming.map((o) => line(o, `${spanText(o, today)}${o.start >= today ? `, ${inWords(daysUntil(o.start, today))}` : ''}`,
                () => { pick(o.start); window.scrollTo({ top: 0 }) }))}
            </ul>
          </section>
        )}
      </section>

      <TaskMenu task={menuTask} actions={menuActions} onClose={() => setMenu(null)} />
      <CalendarSheet sheet={sheet} calendar={calendar} partner={partner} partnerName={partnerName} today={today}
        onClose={() => setSheet(null)}
        onSaved={(iso) => { setSheet(null); if (iso) pick(iso) }}
        onCopy={() => copy(sheet.entry)}
        onDelete={() => { const { entry } = sheet; setSheet(null); remove(entry) }} />
      <CountdownSheet open={!!countdown} item={countdown} onClose={() => setCountdown(null)} countdowns={countdowns}
        userId={userId} partner={partner} partnerName={partnerName} today={today} />
    </main>
  )
}
