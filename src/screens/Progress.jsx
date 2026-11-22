import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTaskData } from '../context/tasks'
import { currentStreak, bestStreak, weekBars, monthGrid, doneLast7Days } from '../lib/stats'
import './Progress.css'

const rise = (i) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] },
})

export default function Progress({ notes }) {
  const { tasks, completions, today, loading } = useTaskData()

  const stats = useMemo(() => ({
    streak: currentStreak(tasks, completions, today),
    best: bestStreak(tasks, completions, today),
    week: weekBars(tasks, completions, today),
    month: monthGrid(tasks, completions, today),
    weekCount: doneLast7Days(completions, today),
  }), [tasks, completions, today])

  const monthName = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long' })
  const nextReward = notes.rewards.find((r) => !r.claimed_at)
  const unlocked = nextReward && stats.streak >= nextReward.streak_required

  if (loading) return <main className="screen tab-screen"><div className="skeleton" /></main>

  return (
    <main className="screen tab-screen progress">
      <motion.h1 className="page-title" {...rise(0)}>Your progress</motion.h1>

      <motion.section className="streak-card" {...rise(1)}>
        <div className="streak-icon">
          <svg className="flame" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z" /></svg>
        </div>
        <div>
          <p className="streak-num">{stats.streak} day{stats.streak === 1 ? '' : 's'}</p>
          <p className="streak-sub">in a row. Your best so far is {Math.max(stats.best, stats.streak)}.</p>
        </div>
      </motion.section>

      <motion.section className="panel" {...rise(2)}>
        <div className="row-between">
          <h2>This week</h2>
          <span className="muted small">{stats.weekCount} tasks done</span>
        </div>
        <div className="week-bars">
          {stats.week.map((d) => (
            <div key={d.iso} className="week-col">
              <div className="bar-track">
                <motion.div
                  className={`bar ${d.full ? 'full' : ''} ${d.isToday ? 'today' : ''}`}
                  initial={{ height: 0 }} animate={{ height: `${d.pct ?? 0}%` }}
                  transition={{ duration: 0.7, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <span className={`bar-label ${d.isToday ? 'today' : ''}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section className="panel" {...rise(3)}>
        <div className="row-between">
          <h2>{monthName}</h2>
          <span className="muted small">Days fully done</span>
        </div>
        <div className="month-grid">
          {stats.month.map((c) => (
            <div key={c.key} className={`month-cell ${c.status} ${c.isToday ? 'is-today' : ''}`} title={c.day ? `${c.day}` : undefined} />
          ))}
        </div>
        <div className="legend">
          <span><i className="month-cell full" />All done</span>
          <span><i className="month-cell partial" />Some done</span>
          <span><i className="month-cell missed" />Missed</span>
        </div>
      </motion.section>

      {nextReward && (
        <motion.section className="panel panel-light reward-card" {...rise(4)}>
          <div className="reward-head">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zM12 8c2-4 6-4 6-1s-6 1-6 1z" /></svg>
            <div>
              <p className="reward-title">{unlocked ? 'Unlocked: ' : 'Next reward: '}{nextReward.title}</p>
              <p className="reward-sub">
                {unlocked ? 'You earned it. Claim it in Notes.' : `${nextReward.streak_required - stats.streak} more day${nextReward.streak_required - stats.streak === 1 ? '' : 's'} to unlock it`}
              </p>
            </div>
          </div>
          <div className="reward-track" role="progressbar" aria-valuemin={0} aria-valuemax={nextReward.streak_required} aria-valuenow={Math.min(stats.streak, nextReward.streak_required)} aria-label="Reward progress">
            <motion.div className="reward-fill" initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (stats.streak / nextReward.streak_required) * 100)}%` }}
              transition={{ duration: 0.8, delay: 0.3 }} />
          </div>
        </motion.section>
      )}
    </main>
  )
}
