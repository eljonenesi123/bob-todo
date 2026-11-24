// Today + the next 5 days; the selected one is a rounded block. The last cell opens the whole month.
// `marks`: day → 'hl' (a highlighted calendar entry) or 'on' (any other one)
export default function DayStrip({ days, selected, marks, onSelect, onMonth }) {
  return (
    <div className="daystrip">
      <div className="day-tabs" role="tablist" aria-label="Plan your days">
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            role="tab"
            aria-selected={d.iso === selected}
            aria-label={`${d.label}, ${d.count} ${d.count === 1 ? 'task' : 'tasks'}${marks[d.iso] ? ', in the calendar' : ''}`}
            className={`day ${d.iso === selected ? 'is-selected' : ''}`}
            onClick={() => onSelect(d.iso)}
          >
            <span className="day-dow">{d.isToday ? 'Today' : d.dow}</span>
            <span className="day-num">{d.num}</span>
            <span className="day-ticks" aria-hidden="true">
              {Array.from({ length: Math.min(d.count, 5) }, (_, i) => <i key={i} />)}
            </span>
            {marks[d.iso] && <span className={`day-mark is-${marks[d.iso]}`} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <button type="button" className="day day-month" aria-label="Open the calendar" onClick={onMonth}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span className="day-dow">Month</span>
      </button>
    </div>
  )
}
