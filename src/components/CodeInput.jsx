import { useState } from 'react'

// What Supabase sends (Authentication → Email → OTP length). Shorter codes work too, with the button.
export const CODE_LENGTH = 8
export const CODE_MIN = 6

// One box per digit on top of one real field, so typing, pasting and the phone's own code suggestion all work
export default function CodeInput({ id, value, onChange, disabled, invalid, describedBy }) {
  const [focused, setFocused] = useState(false)
  const at = Math.min(value.length, CODE_LENGTH - 1)
  return (
    <div className={`code-boxes ${invalid ? 'is-wrong' : ''}`}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <span key={i} aria-hidden="true" className={`code-box ${focused && i === at ? 'is-next' : ''}`}>{value[i] ?? ''}</span>
      ))}
      <input id={id} className="code-real" inputMode="numeric" autoComplete="one-time-code" autoFocus
        aria-invalid={invalid} aria-describedby={describedBy} readOnly={disabled} value={value}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))} />
    </div>
  )
}
