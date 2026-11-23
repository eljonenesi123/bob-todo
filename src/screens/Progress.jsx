import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { currentStreak, bestStreak, weekBars, monthGrid, doneLast7Days } from '../lib/stats'
import BackButton from '../components/BackButton'
import './Progress.css'

const MAX_MARKS = 25
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Tally marks in groups of five, the fifth one crossing the other four
function Tally({ count }) {
  const shown = Math.min(count, MAX_MARKS)
  const groups = Array.from({ length: Math.ceil(shown / 5) }, (_, g) => Math.min(5, shown - g * 5))
  return (
    <span className="streak-tally" aria-hidden="true">
      {groups.map((n, g) => (
        <svg key={g} width="30" height="24" viewBox="0 0 30 24">
          {Array.from({ length: Math.min(n, 4) }, (_, i) => <path key={i} d={`M${5 + i * 6} 3v18`} />)}
          {n === 5 && <path d="M2 18L28 6" />}
        </svg>
      ))}
      {count > MAX_MARKS && <span className="tally-more">+{count - MAX_MARKS}</span>}
    </span>
  )
}

export default function Progress({ notes, onClose }) {
  const { tasks, completions, today, loading } = useTaskData()
  const reduce = useReducedMotion()

  const stats = useMemo(() => ({
    streak: currentStreak(tasks, completions, today),
    best: bestStreak(tasks, completions, today),
    week: weekBars(tasks, completions, today),
    month: monthGrid(tasks, completions, today),
    weekCount: doneLast7Days(completions, today),
  }), [tasks, completions, today])

  const monthName = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long' })
  const best = Math.max(stats.best, stats.streak)
  const nextReward = notes.rewards.find((r) => !r.claimed_at)
  const unlocked = nextReward && stats.streak >= nextReward.streak_required
  const toGo = nextReward ? nextReward.streak_required - stats.streak : 0

  return (
    <main className="paper-page tab-screen progress">
      <h1 className="sr-only">Your progress</h1>
      <div className="desk-head page-head"><BackButton label="Today" onClick={onClose} /></div>
      <header className="desk-head streak-head">
        <div className="mast-date">
          <span className="mast-num">{stats.streak}</span>
          <span className="mast-words">
            <span className="mast-dow">{stats.streak === 1 ? 'day' : 'days'} in a row</span>
            <span className="mast-month">{stats.streak === 0 ? 'Finish today to start one' : `Best so far: ${best}`}</span>
          </span>
        </div>
        {stats.streak > 0 && <Tally count={stats.streak} />}
      </header>

      <section className="pad" aria-label="Your progress">
        {loading ? (
          <div className="pad-loading" aria-label="Loading" />
        ) : (
          <>
            <section className="pad-section">
              <h2 className="pad-h pad-h-row">This week <span>{plural(stats.weekCount, 'task')} done</span></h2>
              <div className="week">
                {stats.week.map((d) => (
                  <div key={d.iso} className={`week-col ${d.full ? 'full' : ''} ${d.pct == null ? 'future' : ''}`}>
                    <div className="week-track">
                      {d.pct != null && (
                        <motion.div className="week-bar"
                          initial={reduce ? false : { height: 0 }} animate={{ height: `${Math.max(d.pct, 4)}%` }}
                          transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }} />
                      )}
                    </div>
                    <span className={`week-label ${d.isToday ? 'hl-static' : ''}`}>{d.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="pad-section">
              <h2 className="pad-h">{monthName}</h2>
              <div className="cal" role="list" aria-label={`${monthName}, day by day`}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i} className="cal-dow" aria-hidden="true">{l}</span>)}
                {stats.month.map((c) => c.status === 'pad'
                  ? <span key={c.key} aria-hidden="true" />
                  : (
                    <span key={c.key} role="listitem" className={`cal-day ${c.status} ${c.isToday ? 'is-today' : ''}`}
                      aria-label={`${c.day}: ${LABELS[c.status]}`}>
                      <span>{c.day}</span>
                    </span>
                  ))}
              </div>
              <p className="pad-note cal-key">
                <span><i className="cal-day full"><span>1</span></i>All done</span>
                <span><i className="cal-day partial"><span>1</span></i>Some done</span>
                <span><i className="cal-day missed"><span>1</span></i>Missed</span>
              </p>
            </section>

            {nextReward && (
              <section className="pad-section">
                <h2 className="pad-h">{unlocked ? 'Reward unlocked' : 'Next reward'}</h2>
                <div className="ruled">
                  <div className="pad-line">
                    <span className="row-margin" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zM12 8c2-4 6-4 6-1s-6 1-6 1z" /></svg>
                    </span>
                    <span className="line-body">
                      <span className="line-title"><span className={unlocked ? 'hl' : ''}>{nextReward.title}</span></span>
                      <span className="line-sub">{unlocked ? 'You earned it. Claim it in Letters.' : `${plural(toGo, 'more day')} to unlock it`}</span>
                    </span>
                  </div>
                </div>
                <div className="reward-track" role="progressbar" aria-label="Reward progress"
                  aria-valuemin={0} aria-valuemax={nextReward.streak_required} aria-valuenow={Math.min(stats.streak, nextReward.streak_required)}>
                  <div className={`reward-fill ${unlocked ? 'done' : ''}`}
                    style={{ width: `${Math.min(100, (stats.streak / nextReward.streak_required) * 100)}%` }} />
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}

const LABELS = { full: 'all done', partial: 'some done', missed: 'missed', empty: 'nothing planned', future: 'still to come' }
