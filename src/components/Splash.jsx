import { motion } from 'framer-motion'
import { quoteOfTheDay } from '../lib/quotes'
import './Splash.css'

// Opening screen: the Tally mark draws itself (four pen strokes, then the highlighter),
// with today's quote underneath. App decides how long it stays.
export default function Splash() {
  return (
    <motion.div className="splash" role="status" aria-label="Opening Bob"
      initial={false} exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}>
      <svg className="splash-mark" width="104" height="100" viewBox="250 262 520 500" aria-hidden="true">
        <g fill="none" stroke="var(--silver)" strokeWidth="44" strokeLinecap="round">
          <path pathLength="1" style={{ '--i': 0 }} d="M355 297 Q350 512 353 727" />
          <path pathLength="1" style={{ '--i': 1 }} d="M453 292 Q460 512 457 732" />
          <path pathLength="1" style={{ '--i': 2 }} d="M550 299 Q545 511 546 723" />
          <path pathLength="1" style={{ '--i': 3 }} d="M647 293 Q652 510 650 728" />
        </g>
        <line className="splash-swipe" pathLength="1" x1="285" y1="641" x2="739" y2="380" stroke="var(--yellow)" strokeWidth="70" />
      </svg>
      <p className="splash-quote">{quoteOfTheDay()}</p>
    </motion.div>
  )
}
