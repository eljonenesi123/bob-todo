import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from './context/tasks'
import { useProfile } from './hooks/useProfile'
import { useNotes } from './hooks/useNotes'
import { usePartner, cleanName } from './hooks/usePartner'
import { useNotebook } from './hooks/useNotebook'
import { useCountdowns } from './hooks/useCountdowns'
import { usePlanDays } from './hooks/usePlanDays'
import { syncPush } from './lib/push'
import AddTaskSheet from './components/AddTaskSheet'
import BottomNav from './components/BottomNav'
import DayComplete from './components/DayComplete'
import UndoBar from './components/UndoBar'
import Today from './screens/Today'
import Progress from './screens/Progress'
import Notebook from './screens/Notebook'
import Notes from './screens/Notes'
import NotesAdmin from './screens/NotesAdmin'
import Nudges from './screens/Nudges'
import './Shell.css'
import './Cards.css'

const CELEBRATED_KEY = 'bob-celebrated-on'
const readCelebrated = () => { try { return localStorage.getItem(CELEBRATED_KEY) } catch { return null } }
const saveCelebrated = (iso) => { try { localStorage.setItem(CELEBRATED_KEY, iso) } catch { /* ignore */ } }

export default function Shell({ user }) {
  const [tab, setTab] = useState('today')
  const { profile, update } = useProfile(user.id)
  const { loading, todayTasks, today, addTask } = useTaskData()
  const days = usePlanDays()
  const [picked, setPicked] = useState(null)
  const day = tab === 'today' && days.some((d) => d.iso === picked) ? picked : today
  const [adding, setAdding] = useState(false)
  const notes = useNotes(user.id)
  const { partner, partnerName } = usePartner(user.id)
  const notebook = useNotebook(user.id)
  const countdowns = useCountdowns(user.id)
  const [notebookView, setNotebookView] = useState('notes')
  // The last thing deleted, with its way back: { text, undo }
  const [notice, setNotice] = useState(null)
  const closeNotice = useCallback(() => setNotice(null), [])
  // Letters tab has two sides for both of you: what you received, and writing to the other
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

  const notify = (n) => setNotice({ ...n, id: crypto.randomUUID() })

  function openTab(id) {
    if (id === 'today') setPicked(null)
    setTab(id)
  }

  async function addFromPlus(fields) {
    await addTask(fields)
    // On Today the new card shows up by itself; from anywhere else, say so
    if (tab !== 'today') {
      const d = days.find((x) => x.iso === fields.due_on)
      notify({ text: `Added to ${d && !d.isToday ? d.label : 'today'}` })
    }
  }

  const switcher = (
    <div className="pills notes-switch" role="group" aria-label="Letters">
      <button type="button" className={`pill ${notesView === 'inbox' ? 'is-on' : ''}`} aria-pressed={notesView === 'inbox'}
        onClick={() => setNotesView('inbox')}>For you{notes.hasNew ? ' (new)' : ''}</button>
      <button type="button" className={`pill ${notesView === 'write' ? 'is-on' : ''}`} aria-pressed={notesView === 'write'}
        onClick={() => setNotesView('write')}>{partnerName ? `Write to ${partnerName}` : 'Write a letter'}</button>
    </div>
  )

  const screens = {
    today: <Today name={cleanName(profile?.display_name)} days={days} selected={day} onSelect={setPicked} countdowns={countdowns}
      onOpenCountdowns={() => { setNotebookView('countdowns'); setTab('notebook') }}
      onNotice={notify}
      onOpenProgress={() => { setTab('progress'); window.scrollTo(0, 0) }} />,
    notebook: <Notebook userId={user.id} notebook={notebook} countdowns={countdowns} partner={partner} partnerName={partnerName}
      view={notebookView} onView={setNotebookView} />,
    progress: <Progress notes={notes} onClose={() => { setTab('today'); window.scrollTo(0, 0) }} />,
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

      {/* Progress opens from Today, so it belongs to that tab */}
      <BottomNav tab={tab === 'progress' ? 'today' : tab} onChange={openTab} onAdd={() => setAdding(true)} notesDot={notes.hasNew} nudgesDot={pushIssue} />

      <AddTaskSheet open={adding} onClose={() => setAdding(false)} onAdd={addFromPlus}
        bigCount={todayTasks.filter((t) => t.is_big3).length} days={days} day={day} />

      <AnimatePresence>
        {notice && (
          <UndoBar key={notice.id} text={notice.text} onClose={closeNotice}
            onUndo={notice.undo && (() => { closeNotice(); notice.undo() })} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCelebration && (
          <DayComplete key="done" notes={notes} total={total} onClose={closeCelebration} />
        )}
      </AnimatePresence>
    </>
  )
}
