import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { saveFocus } from '../lib/focus'
import './FocusTimer.css'

const PRESETS = [10, 25, 45]

const clock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// session: { taskId, title, minutes, endsAt (ms) | null, left (ms, when paused) | null }
export default function FocusTimer({ session: initial, canFinish, onDone, onClose }) {
  const [session, setSession] = useState(initial)
  const [now, setNow] = useState(() => Date.now())

  const running = !!session.endsAt
  const left = running ? session.endsAt - now : session.left ?? session.minutes * 60000
  const started = running || session.left != null
  const finished = started && left <= 0

  useEffect(() => { saveFocus(session) }, [session])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => {
    if (finished) navigator.vibrate?.([200, 100, 200])
  }, [finished])

  const start = (minutes = session.minutes) => {
    const t = Date.now()
    setNow(t)
    setSession((s) => ({ ...s, minutes, endsAt: t + minutes * 60000, left: null }))
  }
  const pause = () => setSession((s) => ({ ...s, endsAt: null, left: Math.max(0, s.endsAt - Date.now()) }))
  const resume = () => { const t = Date.now(); setNow(t); setSession((s) => ({ ...s, endsAt: t + s.left, left: null })) }
  const more = () => { const t = Date.now(); setNow(t); setSession((s) => ({ ...s, endsAt: t + 5 * 60000, left: null })) }
  const close = () => { saveFocus(null); onClose() }
  const done = () => { saveFocus(null); onDone(session.taskId) }

  const fraction = Math.min(1, Math.max(0, left / (session.minutes * 60000)))

  return (
    <motion.div className="focus" role="dialog" aria-modal="true" aria-label={`Focus on ${session.title}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="focus-sheet">
        <div className="focus-top">
          <span className="focus-label">Focus</span>
          <button type="button" className="sheet-close" onClick={close}>{started && !finished ? 'Stop' : 'Close'}</button>
        </div>

        <p className="focus-title"><span className="hl-static">{session.title}</span></p>

        <p className="focus-clock" role="timer" aria-live="off" aria-label={finished ? 'Time is up' : `${clock(left)} left`}>
          {finished ? 'Done' : clock(left)}
        </p>
        <div className="focus-line" aria-hidden="true"><span style={{ transform: `scaleX(${fraction})` }} /></div>

        {!started && (
          <>
            <div className="pills focus-presets" role="group" aria-label="How long">
              {PRESETS.map((m) => (
                <button key={m} type="button" className={`pill ${session.minutes === m ? 'is-on' : ''}`} aria-pressed={session.minutes === m}
                  onClick={() => setSession((s) => ({ ...s, minutes: m }))}>{m} min</button>
              ))}
            </div>
            <button type="button" className="btn btn-ink" onClick={() => start()}>Start {session.minutes} minutes</button>
          </>
        )}

        {started && !finished && (
          running
            ? <button type="button" className="btn btn-ink" onClick={pause}>Pause</button>
            : <button type="button" className="btn btn-ink" onClick={resume}>Keep going</button>
        )}

        {finished && (
          <div className="focus-end" role="status">
            <p className="focus-msg">Time’s up. How did it go?</p>
            {canFinish && <button type="button" className="btn btn-ink" onClick={done}>Mark it done</button>}
            <button type="button" className="ink-btn" onClick={more}>Five more minutes</button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
