import { useEffect, useState } from 'react'
import { photoUrl } from '../lib/photo'

// The photo of an open letter
export default function LetterPhoto({ path, alt }) {
  const [state, setState] = useState({ url: '', failed: false })
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let active = true
    photoUrl(path)
      .then((url) => { if (active) setState({ url, failed: false }) })
      .catch(() => { if (active) setState({ url: '', failed: true }) })
    return () => { active = false }
  }, [path, tries])

  if (state.failed) {
    return (
      <div className="letter-photo-failed" role="alert">
        <p>The photo didn’t open. Check your connection.</p>
        <button type="button" className="ink-btn" onClick={() => setTries((n) => n + 1)}>Try again</button>
      </div>
    )
  }
  return state.url
    ? <img className="letter-photo" src={state.url} alt={alt} onError={() => setState({ url: '', failed: true })} />
    : <div className="letter-photo is-loading" aria-label="Opening the photo" />
}
