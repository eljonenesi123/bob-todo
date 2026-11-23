import { useEffect, useRef, useState } from 'react'
import { shrinkPhoto } from '../lib/photo'

// One photo for a letter. `photo` is { blob, url } or null.
export default function PhotoPicker({ photo, onChange, disabled }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  async function pick(e) {
    const file = e.target.files[0]
    e.target.value = '' // so the same photo can be picked again
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const blob = await shrinkPhoto(file)
      onChange({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setError('That photo can’t be opened here. Try another one.')
    }
    setBusy(false)
  }

  return (
    <div className="photo-pick">
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      {photo && <img className="photo-thumb" src={photo.url} alt="The photo you picked" />}
      <button type="button" className="ink-btn" disabled={busy || disabled} onClick={() => input.current.click()}>
        {busy ? 'Opening…' : photo ? 'Change photo' : 'Add a photo'}
      </button>
      {photo && <button type="button" className="sheet-close" disabled={disabled} onClick={() => onChange(null)}>Remove</button>}
      {error && <p className="error on-paper" role="alert">{error}</p>}
    </div>
  )
}
