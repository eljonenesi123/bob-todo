import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import './Welcome.css'

export default function Welcome() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (error) return setError(error.message)
    setStep('code')
  }

  async function verifyCode(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(), token: code.trim(), type: 'email',
    })
    setBusy(false)
    if (error) setError("That code didn't work. Check it and try again.")
  }

  return (
    <main className="paper-page welcome">
      <header className="desk-head welcome-head">
        {/* The Tally mark from the app icon: four pen strokes, the fifth in highlighter */}
        <svg className="welcome-mark" width="72" height="69" viewBox="250 262 520 500" aria-hidden="true">
          <g fill="none" stroke="var(--silver)" strokeWidth="44" strokeLinecap="round">
            <path d="M355 297 Q350 512 353 727" /><path d="M453 292 Q460 512 457 732" />
            <path d="M550 299 Q545 511 546 723" /><path d="M647 293 Q652 510 650 728" />
          </g>
          <line x1="285" y1="641" x2="739" y2="380" stroke="var(--yellow)" strokeWidth="70" />
        </svg>
        <h1 className="welcome-title">Bob</h1>
        <p className="welcome-tagline">Your day, one small win at a time.</p>
      </header>

      <section className="pad welcome-pad">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'email' ? (
            <motion.form key="email" className="welcome-form" onSubmit={sendCode}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="pad-h">Sign in or create your account</h2>
              <div className="pad-block welcome-fields">
                <label className="field-label" htmlFor="email">Your email</label>
                <input id="email" className="line-input" type="email" required autoComplete="email"
                  placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                {error && <p className="error on-paper" role="alert">{error}</p>}
                <button className="btn btn-ink" disabled={busy}>{busy ? 'Sending…' : 'Send me a code'}</button>
                <p className="field-hint">New here? The code creates your account. No password, ever.</p>
              </div>
            </motion.form>
          ) : (
            <motion.form key="code" className="welcome-form" onSubmit={verifyCode}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="pad-h">Check your email</h2>
              <div className="pad-block welcome-fields">
                <label className="field-label" htmlFor="code">Enter the code we sent to {email}</label>
                <input id="code" className="line-input code-field" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={8} required placeholder="000000" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                {error && <p className="error on-paper" role="alert">{error}</p>}
                <button className="btn btn-ink" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
                <button type="button" className="ink-btn welcome-back" onClick={() => { setStep('email'); setCode(''); setError('') }}>
                  Use a different email
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </main>
  )
}
