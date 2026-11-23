import { useState } from 'react'
import { makeBackup, saveFile } from '../lib/backup'

// Two taps on purpose: a phone only opens its share sheet straight from a tap, and collecting takes a moment
export default function Backup({ userId }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [failed, setFailed] = useState(false)

  async function run(action) {
    setBusy(true)
    setText('')
    setFailed(false)
    try {
      await action()
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  const collect = () => run(async () => setFile(await makeBackup(userId)))
  const save = () => run(async () => {
    if (!await saveFile(file)) return
    setFile(null)
    setText('Done. Keep the file somewhere safe and private.')
  })

  return (
    <section className="pad-section">
      <h2 className="pad-h">Backup</h2>
      <div className="pad-block backup">
        <p className="field-hint">A file with your tasks, notes, countdowns and letters. Locked groups stay encrypted; photos aren’t in it.</p>
        <button type="button" className="ink-btn" disabled={busy} onClick={file ? save : collect}>
          {busy ? 'One moment…' : file ? 'Save the file' : 'Export my data'}
        </button>
        {text && <p className="field-hint" role="status">{text}</p>}
        {failed && <p className="error" role="alert">{file ? 'The file wasn’t saved. Try again.' : 'Bob couldn’t collect your data. Check your connection and try again.'}</p>}
      </div>
    </section>
  )
}
