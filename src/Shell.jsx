import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from './context/tasks'
import { useProfile } from './hooks/useProfile'
import { useNotes } from './hooks/useNotes'
import { usePartner, cleanName } from './hooks/usePartner'
import { syncPush } from './lib/push'
import BottomNav from './components/BottomNav'
import DayComplete from './components/DayComplete'
import Today from './screens/Today'
import Progress from './screens/Progress'
import Notes from './screens/Notes'
import NotesAdmin from './screens/NotesAdmin'
import Nudges from './screens/Nudges'
import './Shell.css'

const CELEBRATED_KEY = 'bob-celebrated-on'
const readCelebrated = () => { try { return localStorage.getItem(CELEBRATED_KEY) } catch { return null } }
const saveCelebrated = (iso) => { try { localStorage.setItem(CELEBRATED_KEY, iso) } catch { /* ignore */ } }

export default function Shell({ user }) {
  const [tab, setTab] = useState('today')
  const { profile, update } = useProfile(user.id)
  const { loading, todayTasks, today } = useTaskData()
  const notes = useNotes(user.id)
  const { partner, partnerName } = usePartner(user.id)
  // Notes tab has two sides for both of you: what you received, and writing to the other
  const [notesView, setNotesView] = useState('inbox')
  const [celebrated, setCelebrated] = useState(readCelebrated)

  // A dot on Nudges when notifications are allowed but this phone couldn't be connected
  const [pushIssue, setPushIssue] = useState(false)
  useEffect(() => {
    let active = true
    syncPush().then((ok) => { if (active) setPushIssue(!ok) })
    return () => { active = false }
  }, [])
  const onPushFixed = useCallback(() => setPushIssue(false), [])

  const total = todayTasks.length
  const allDone = !loading && total > 0 && todayTasks.every((t) => t.done)
  const showCelebration = allDone && celebrated !== today

  function closeCelebration() {
    saveCelebrated(today)
    setCelebrated(today)
  }

  const switcher = (
    <div className="pills notes-switch" role="group" aria-label="Notes">
      <button type="button" className={`pill ${notesView === 'inbox' ? 'is-on' : ''}`} aria-pressed={notesView === 'inbox'}
        onClick={() => setNotesView('inbox')}>For you{notes.hasNew ? ' (new)' : ''}</button>
      <button type="button" className={`pill ${notesView === 'write' ? 'is-on' : ''}`} aria-pressed={notesView === 'write'}
        onClick={() => setNotesView('write')}>{partnerName ? `Write to ${partnerName}` : 'Write a note'}</button>
    </div>
  )

  const screens = {
    today: <Today name={cleanName(profile?.display_name)} />,
    progress: <Progress notes={notes} />,
    notes: notesView === 'write'
      ? <NotesAdmin userId={user.id} partner={partner} partnerName={partnerName} switcher={switcher} />
      : <Notes notes={notes} allDone={allDone} switcher={switcher} />,
    nudges: <Nudges profile={profile} update={update} onPushFixed={onPushFixed} partnerName={partnerName} />,
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {screens[tab]}
        </motion.div>
      </AnimatePresence>

      <BottomNav tab={tab} onChange={setTab} notesDot={notes.hasNew} nudgesDot={pushIssue} />

      <AnimatePresence>
        {showCelebration && (
          <DayComplete key="done" notes={notes} total={total} onClose={closeCelebration} />
        )}
      </AnimatePresence>
    </>
  )
}
