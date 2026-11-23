// Today + the next 5 days; the selected one is a rounded block
export default function DayStrip({ days, selected, onSelect }) {
  return (
    <div className="daystrip" role="tablist" aria-label="Plan your days">
      {days.map((d) => (
        <button
          key={d.iso}
          type="button"
          role="tab"
          aria-selected={d.iso === selected}
          aria-label={`${d.label}, ${d.count} ${d.count === 1 ? 'task' : 'tasks'}`}
          className={`day ${d.iso === selected ? 'is-selected' : ''}`}
          onClick={() => onSelect(d.iso)}
        >
          <span className="day-dow">{d.isToday ? 'Today' : d.dow}</span>
          <span className="day-num">{d.num}</span>
          <span className="day-ticks" aria-hidden="true">
            {Array.from({ length: Math.min(d.count, 5) }, (_, i) => <i key={i} />)}
          </span>
        </button>
      ))}
    </div>
  )
}
