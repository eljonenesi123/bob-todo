import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { readPending, savePending, clearPending, sendError, verifyError, RESEND_S } from '../lib/signin'
import { useVisibleHeight } from '../hooks/useVisibleHeight'
import BackButton from '../components/BackButton'
import CodeInput, { CODE_LENGTH } from '../components/CodeInput'
import './Auth.css'

// The Tally mark from the app icon: four pen strokes, the fifth in highlighter
const Tally = () => (
  <svg className="auth-mark" width="104" height="100" viewBox="250 262 520 500" aria-hidden="true">
    <g fill="none" stroke="var(--silver)" strokeWidth="44" strokeLinecap="round">
      <path d="M355 297 Q350 512 353 727" /><path d="M453 292 Q460 512 457 732" />
      <path d="M550 299 Q545 511 546 723" /><path d="M647 293 Q652 510 650 728" />
    </g>
    <line x1="285" y1="641" x2="739" y2="380" stroke="var(--yellow)" strokeWidth="70" />
  </svg>
)

// Seconds until another code may be sent
function useWait(sentAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return sentAt ? Math.max(0, Math.min(RESEND_S, Math.ceil(RESEND_S - (now - sentAt) / 1000))) : 0
}

export default function Welcome() {
  const [pending] = useState(readPending)
  const [step, setStep] = useState(pending ? 'code' : 'start') // 'start' | 'email' | 'code'
  const [email, setEmail] = useState(pending?.email ?? '')
  const [sentAt, setSentAt] = useState(pending?.sentAt ?? 0)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const wait = useWait(sentAt)
  const reduce = useReducedMotion()
  const height = useVisibleHeight()

  function go(next) {
    setError('')
    setInfo('')
    setStep(next)
    window.scrollTo(0, 0)
  }

  // Answers true when a code is on its way
  async function sendCode() {
    setBusy(true)
    setError('')
    setInfo('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (error) { setError(sendError(error)); return false }
    const now = Date.now()
    setSentAt(now)
    savePending({ email: email.trim(), sentAt: now })
    setCode('')
    return true
  }

  async function submitEmail(e) {
    e.preventDefault()
    if (!busy && await sendCode()) go('code')
  }

  async function sendAgain() {
    if (await sendCode()) setInfo('A new code is on its way. The old one no longer works.')
  }

  async function verify(token) {
    if (busy || token.length < CODE_LENGTH) return
    setBusy(true)
    setError('')
    setInfo('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
    setBusy(false)
    if (error) return setError(verifyError(error))
    clearPending()
  }

  function typeCode(next) {
    setCode(next)
    setError('')
    // All six are in: no need to tap the button as well
    if (next.length === CODE_LENGTH && code.length < CODE_LENGTH) verify(next)
  }

  function otherEmail() {
    clearPending()
    setCode('')
    setSentAt(0)
    go('email')
  }

  // With the keyboard open, the form sits right above it
  const fit = height ? { minHeight: height } : undefined
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
  const rise = { initial: reduce ? false : { y: 48 }, animate: { y: 0 }, transition: { type: 'spring', stiffness: 320, damping: 34 } }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'start' && (
        <motion.main key="start" className="auth auth-start" {...fade}>
          <div className="auth-hero">
            <Tally />
            <h1 className="auth-name">Bob</h1>
          </div>
          <div className="auth-intro">
            <p className="auth-line">Your day, one small win at a time.</p>
            <p className="auth-sub">Plan what matters and keep your notes in one place.</p>
            <button type="button" className="btn auth-go" onClick={() => go('email')}>Get started</button>
          </div>
        </motion.main>
      )}

      {step === 'email' && (
        <motion.main key="email" className="auth" style={fit} {...fade}>
          <header className="auth-head">
            <BackButton label="Back" onClick={() => go('start')} />
            <div className="auth-gap"><Tally /></div>
            <h1 className="auth-title">Nice to see you</h1>
            <p className="auth-sub">Sign in with your email. There’s no password to remember.</p>
          </header>
          <motion.form className="auth-sheet" onSubmit={submitEmail} {...rise}>
            <label className="auth-label" htmlFor="email">Your email</label>
            <input id="email" className="auth-field" type="email" required autoComplete="email" autoCapitalize="none" autoFocus
              aria-invalid={!!error} aria-describedby={error ? 'email-error' : undefined}
              placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
            {error && <p id="email-error" className="error on-paper" role="alert">{error}</p>}
            <button className="btn btn-ink" disabled={busy}>{busy ? 'Sending…' : 'Send me a code'}</button>
          </motion.form>
        </motion.main>
      )}

      {step === 'code' && (
        <motion.main key="code" className="auth" style={fit} {...fade}>
          <header className="auth-head">
            <BackButton label="Use another email" onClick={otherEmail} />
            <div className="auth-gap"><Tally /></div>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-sub">We sent a code to <strong>{email}</strong></p>
          </header>
          <motion.form className="auth-sheet" onSubmit={(e) => { e.preventDefault(); verify(code) }} {...rise}>
            <label className="auth-label" htmlFor="code">The 6-digit code</label>
            <CodeInput id="code" value={code} onChange={typeCode} disabled={busy} invalid={!!error} describedBy={error ? 'code-error' : undefined} />
            {error && <p id="code-error" className="error on-paper" role="alert">{error}</p>}
            {info && <p className="auth-info" role="status">{info}</p>}
            <button className="btn btn-ink" disabled={busy || code.length < CODE_LENGTH}>{busy ? 'One moment…' : 'Sign in'}</button>
            <button type="button" className="auth-again" disabled={busy || wait > 0} onClick={sendAgain}>
              {wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}
            </button>
            <p className="auth-note">Can’t find it? Look in the spam folder too.</p>
          </motion.form>
        </motion.main>
      )}
    </AnimatePresence>
  )
}
