import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import './Welcome.css'

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] },
})

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
    <main className="screen welcome">
      <div className="welcome-ring big" aria-hidden="true" />
      <div className="welcome-ring small" aria-hidden="true" />

      <div className="welcome-top">
        <motion.div
          className="welcome-logo"
          initial={{ scale: 0, rotate: -120 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        >
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#2B2D31" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" />
            <path className="welcome-rays" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </motion.div>
        <motion.div {...rise(0.35)}>
          <h1 className="welcome-title">Bob</h1>
          <p className="welcome-tagline">Your day, one small win at a time.</p>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'email' ? (
          <motion.form key="email" className="welcome-form" onSubmit={sendCode}
            {...rise(0.55)} exit={{ opacity: 0, y: -12 }}>
            <h2 className="welcome-form-title">Sign in or create your account</h2>
            <label className="label" htmlFor="email">Your email</label>
            <input id="email" className="field" type="email" required autoComplete="email"
              placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send me a code'}
            </button>
            <p className="welcome-hint">New here? The code creates your account.<br />No password, ever.</p>
          </motion.form>
        ) : (
          <motion.form key="code" className="welcome-form" onSubmit={verifyCode}
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h2 className="welcome-form-title">Check your email</h2>
            <label className="label" htmlFor="code">Enter the code we sent to {email}</label>
            <input id="code" className="field code-field" inputMode="numeric" autoComplete="one-time-code"
              maxLength={8} required placeholder="••••••" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep('email'); setCode(''); setError('') }}>
              Use a different email
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  )
}
