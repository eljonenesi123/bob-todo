import { motion } from 'framer-motion'

const R = 40
const C = 2 * Math.PI * R

export default function ProgressCard({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const left = total - done
  const msg = left === 0 ? 'All done. Go open your note!'
    : left === 1 ? 'Just 1 left. Finish strong.'
    : `${left} left. You've got this.`

  return (
    <section className="card progress-card">
      <div className="ring">
        <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={`${done} of ${total} tasks done`}>
          <circle cx="48" cy="48" r={R} fill="none" stroke="var(--gray-3)" strokeWidth="10" />
          <motion.circle
            cx="48" cy="48" r={R} fill="none" stroke="var(--yellow)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} transform="rotate(-90 48 48)"
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - (total ? done / total : 0)) }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <span className="ring-pct">{pct}%</span>
      </div>
      <div className="progress-text">
        <p className="progress-count">{done} of {total} done</p>
        <p className="progress-msg">{msg}</p>
      </div>
    </section>
  )
}
