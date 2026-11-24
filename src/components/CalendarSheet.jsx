import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { addDays, toISO } from '../lib/dates'
import { daysUntil } from '../lib/countdown'
import { dayText, startOf, nextStarts, longest, weekdayInMonth, dayInMonth } from '../lib/calendar'
import { deviceStatus } from '../lib/push'
import CheckRow from './CheckRow'
import PaperSheet from './PaperSheet'

const REPEATS = [
  { id: 'never', label: 'Doesn’t repeat' },
  { id: 'weeks', label: 'Every few weeks' },
  { id: 'month', label: 'Every month' },
  { id: 'year', label: 'Every year' },
]
const REMINDERS = [
  { id: 0, label: 'On the day' },
  { id: 1, label: 'The day before' },
  { id: 2, label: '2 days before' },
  { id: 7, label: 'A week before' },
]
const DEFAULT_TIME = '18:00'
const DEFAULT_WEEKS = 4
const isMonthly = (repeat) => repeat === 'month_date' || repeat === 'month_weekday'

// New entry, all of an entry, or only one time of a repeating one.
// `sheet`: { mode: 'new' | 'all' | 'one', entry, start, end, day }; in mode 'new', `entry` is one to copy
export default function CalendarSheet({ sheet, ...rest }) {
  return (
    <AnimatePresence>
      {sheet && <Sheet key={`${sheet.mode}-${sheet.entry?.id}-${sheet.start}`} {...sheet} {...rest} />}
    </AnimatePresence>
  )
}

function Sheet({ mode, entry, start, end, day, onClose, onSaved, onDelete, onCopy, calendar, partner, partnerName, today }) {
  const [form, setForm] = useState(() => {
    const starts_on = mode === 'new' ? day : mode === 'one' ? start : entry.starts_on
    const length = entry ? daysUntil(entry.ends_on, entry.starts_on) : 0
    return {
      title: entry?.title ?? '',
      starts_on,
      ends_on: mode === 'one' ? end : addDays(starts_on, length),
      at_time: entry?.at_time?.slice(0, 5) ?? '',
      // A copy, or only one time, stands by itself
      repeat: mode === 'all' ? entry.repeat : 'never',
      every: mode === 'all' && entry.repeat === 'weeks' ? entry.every : DEFAULT_WEEKS,
      ending: mode === 'all' && !!entry.until,
      until: (mode === 'all' && entry.until) || '',
      remind_days: entry?.remind_days ?? [1],
      remind_at: entry?.remind_at?.slice(0, 5) ?? DEFAULT_TIME,
      remind_partner: entry?.remind_partner ?? false,
      highlight: entry?.highlight ?? false,
      shared: !!entry?.shared_with,
    }
  })
  const [pushOff, setPushOff] = useState(false)
  const [now] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (fields) => setForm((f) => ({ ...f, ...fields }))

  // Without notifications on this phone the reminder has nowhere to go
  useEffect(() => {
    let active = true
    deviceStatus().then((s) => { if (active) setPushOff(s !== 'on') }).catch(() => {})
    return () => { active = false }
  }, [])

  const oneDay = form.starts_on === form.ends_on
  const repeats = form.repeat !== 'never'
  const rule = {
    starts_on: form.starts_on, ends_on: form.ends_on, repeat: form.repeat,
    every: form.repeat === 'weeks' ? form.every : 1,
    until: repeats && form.ending && form.until ? form.until : null,
  }
  const dated = !!form.starts_on && !!form.ends_on
  // Another pattern has other dates, so the skipped ones mean nothing any more
  const newPattern = mode === 'all' && ['starts_on', 'repeat', 'every'].some((k) => rule[k] !== entry[k])
  const skipped = mode === 'all' && !newPattern ? entry.skipped : []

  const problem = !dated ? ''
    : form.ends_on < form.starts_on ? 'It ends before it starts. Pick a later last day.'
      : daysUntil(form.ends_on, form.starts_on) >= longest(rule) ? (repeats ? 'It’s still going on when the next one starts. Make it shorter or repeat it less often.' : 'It’s longer than a year. Pick an earlier last day.')
        : rule.until && rule.until < form.starts_on ? 'It stops repeating before it starts. Pick a later date.'
          : ''

  function pickStart(starts_on) {
    if (!starts_on) return set({ starts_on })
    // The length stays the same when the start moves
    const length = dated ? Math.max(0, daysUntil(form.ends_on, form.starts_on)) : 0
    set({ starts_on, ends_on: addDays(starts_on, length) })
  }
  function pickRepeat(id) {
    if (id !== 'month') return set({ repeat: id })
    // A whole week usually follows the weekday, a single date the date
    if (!isMonthly(form.repeat)) set({ repeat: oneDay ? 'month_date' : 'month_weekday' })
  }

  // The dates this makes, in words
  function preview() {
    if (!dated || problem || !repeats) return null
    const from = form.starts_on > today ? form.starts_on : today
    const next = nextStarts({ ...rule, skipped }, from, 3).map((d) => dayText(d, today))
    if (!next.length) return <p className="field-hint">It doesn’t happen again after today.</p>
    const list = next.length === 1 ? next[0] : `${next.slice(0, -1).join(', ')} and ${next.at(-1)}`
    return <p className="field-hint cal-next" role="status">{startOf(rule, 0) >= today ? 'Starts' : 'Next'} <strong>{list}</strong></p>
  }

  // A reminder time that has gone by already, or that comes after an appointment
  function remindHint() {
    if (!dated || problem || !form.remind_days.length || !form.remind_at) return ''
    const iso = toISO(now)
    const clock = now.toTimeString().slice(0, 5)
    const next = nextStarts({ ...rule, skipped }, iso, 1)[0]
    if (!next) return ''
    const gone = (n) => { const d = addDays(next, -n); return d < iso || (d === iso && form.remind_at <= clock) }
    if (form.remind_days.every(gone)) return repeats ? 'It’s too late to be reminded of the first one, so this starts with the next.' : 'It’s too late for this reminder. Pick a later time.'
    if (oneDay && form.at_time && form.remind_days.includes(0) && form.remind_at > form.at_time) return 'On the day, the reminder comes after it has started.'
    return ''
  }

  const ready = form.title.trim() && dated && !problem && !(repeats && form.ending && !form.until)

  async function submit() {
    if (!ready || busy) return
    const fields = {
      ...rule,
      title: form.title.trim(),
      at_time: oneDay && form.at_time ? form.at_time : null,
      remind_days: [...form.remind_days].sort((a, b) => a - b),
      remind_at: form.remind_at || DEFAULT_TIME,
      highlight: form.highlight,
    }
    if (partner) {
      fields.shared_with = form.shared ? partner.id : null
      fields.remind_partner = form.shared && form.remind_partner
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'all') await calendar.update(entry, newPattern ? { ...fields, skipped: [] } : fields)
      else await calendar.add(mode === 'one' ? { ...fields, moved_from: entry.id, moved_day: start } : fields)
      onSaved(mode === 'all' && repeats ? null : fields.starts_on)
    } catch {
      setError('It wasn’t saved. Check your connection and try again.')
      setBusy(false)
    }
  }

  const title = mode === 'new' ? 'New in calendar' : mode === 'one' ? 'Change only this one' : repeats && entry.repeat !== 'never' ? 'Change all of them' : 'Edit'
  const hint = remindHint()

  return (
    <PaperSheet title={title} onClose={onClose} onSubmit={submit}>
      <input className="line-input big-input" autoFocus={mode === 'new' && !entry} maxLength={80} aria-label="What is it"
        placeholder="What is it?" value={form.title} onChange={(e) => set({ title: e.target.value })} />

      <div className="cal-dates">
        <label className="sheet-field">
          <span className="legend-like">{repeats ? 'First one from' : 'From'}</span>
          <input type="date" className="line-input" required value={form.starts_on} onChange={(e) => pickStart(e.target.value)} />
        </label>
        <label className="sheet-field">
          <span className="legend-like">Last day</span>
          <input type="date" className="line-input" required min={form.starts_on || undefined} value={form.ends_on} onChange={(e) => set({ ends_on: e.target.value })} />
        </label>
      </div>
      {problem && <p className="error on-paper" role="alert">{problem}</p>}

      {oneDay && dated && (
        <label className="sheet-field">
          <span className="legend-like">Starts at <span className="optional">optional</span></span>
          <input type="time" className="line-input time-input" value={form.at_time} onChange={(e) => set({ at_time: e.target.value })} />
        </label>
      )}

      {mode !== 'one' && (
        <fieldset className="pills-group cal-pills">
          <legend>Repeat</legend>
          <div className="pills">
            {REPEATS.map((r) => {
              const on = r.id === 'month' ? isMonthly(form.repeat) : form.repeat === r.id
              return <button type="button" key={r.id} className={`pill ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => pickRepeat(r.id)}>{r.label}</button>
            })}
          </div>
          {form.repeat === 'weeks' && (
            <div className="cal-stepper">
              <button type="button" aria-label="Fewer weeks" disabled={form.every <= 1} onClick={() => set({ every: form.every - 1 })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
              </button>
              <span role="status">{form.every === 1 ? 'Every week' : `Every ${form.every} weeks`}</span>
              <button type="button" aria-label="More weeks" disabled={form.every >= 12} onClick={() => set({ every: form.every + 1 })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          )}
          {isMonthly(form.repeat) && dated && (
            <div className="pills">
              <button type="button" className={`pill ${form.repeat === 'month_weekday' ? 'is-on' : ''}`} aria-pressed={form.repeat === 'month_weekday'}
                onClick={() => set({ repeat: 'month_weekday' })}>On the {weekdayInMonth(form.starts_on)}</button>
              <button type="button" className={`pill ${form.repeat === 'month_date' ? 'is-on' : ''}`} aria-pressed={form.repeat === 'month_date'}
                onClick={() => set({ repeat: 'month_date' })}>On the {dayInMonth(form.starts_on)}</button>
            </div>
          )}
          {preview()}
          {newPattern && entry.skipped.length > 0 && <p className="field-hint">Dates you skipped or moved before can come back with the new pattern.</p>}
        </fieldset>
      )}
      {mode !== 'one' && repeats && (
        <div className="sheet-check">
          <CheckRow label="Stop repeating on a date" checked={form.ending} onChange={(v) => set({ ending: v })} />
          {form.ending && (
            <label className="check-time cal-until">
              <span>After</span>
              <input type="date" className="line-input" min={form.starts_on || undefined} value={form.until} onChange={(e) => set({ until: e.target.value })} />
            </label>
          )}
        </div>
      )}

      <fieldset className="pills-group cal-pills">
        <legend>Remind me</legend>
        <div className="pills">
          {REMINDERS.map((r) => {
            const on = form.remind_days.includes(r.id)
            return (
              <button type="button" key={r.id} className={`pill ${on ? 'is-on' : ''}`} aria-pressed={on}
                onClick={() => set({ remind_days: on ? form.remind_days.filter((n) => n !== r.id) : [...form.remind_days, r.id] })}>{r.label}</button>
            )
          })}
        </div>
        {form.remind_days.length > 0 ? (
          <label className="check-time cal-at">
            <span>At</span>
            <input type="time" className="line-input" value={form.remind_at} onChange={(e) => set({ remind_at: e.target.value })} />
          </label>
        ) : <p className="field-hint">No reminder.</p>}
        {hint && <p className="field-hint">{hint}</p>}
        {form.remind_days.length > 0 && pushOff && <p className="field-hint">Notifications are off on this device. Turn them on in Nudges.</p>}
      </fieldset>

      <CheckRow label={<span className={form.highlight ? 'hl-static' : ''}>Highlight it</span>} hint="Yellow, for what you don’t want to miss."
        checked={form.highlight} onChange={(v) => set({ highlight: v })} />

      {partner && (
        <CheckRow label={`Share with ${partnerName || 'my person'}`} hint={`${partnerName || 'They'} can see it but not change it.`}
          checked={form.shared} onChange={(v) => set({ shared: v })} />
      )}
      {partner && form.shared && form.remind_days.length > 0 && (
        <CheckRow label={`Remind ${partnerName || 'them'} too`} checked={form.remind_partner} onChange={(v) => set({ remind_partner: v })} />
      )}

      {error && <p className="error on-paper" role="alert">{error}</p>}
      <button className="btn btn-ink" disabled={busy || !ready}>
        {busy ? 'Saving…' : mode === 'new' ? 'Add to calendar' : 'Save changes'}
      </button>
      {mode === 'all' && (
        <div className="sheet-more">
          {entry.repeat === 'never' && <button type="button" className="ink-btn" disabled={busy} onClick={onCopy}>Add another</button>}
          <button type="button" className="ink-btn danger" disabled={busy} onClick={onDelete}>{entry.repeat === 'never' ? 'Delete' : 'Delete all of them'}</button>
        </div>
      )}
    </PaperSheet>
  )
}
