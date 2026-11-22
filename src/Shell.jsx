import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskData } from './context/tasks'
import { useProfile } from './hooks/useProfile'
import { useNotes } from './hooks/useNotes'
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
  const isAdmin = profile?.role === 'admin'
  const { loading, todayTasks, today } = useTaskData()
  const notes = useNotes(user.id)
  const [celebrated, setCelebrated] = useState(readCelebrated)

  useEffect(() => { syncPush() }, [])

  const total = todayTasks.length
  const allDone = !loading && total > 0 && todayTasks.every((t) => t.done)
  const showCelebration = allDone && celebrated !== today

  function closeCelebration() {
    saveCelebrated(today)
    setCelebrated(today)
  }

  const screens = {
    today: <Today />,
    progress: <Progress notes={notes} />,
    notes: isAdmin ? <NotesAdmin userId={user.id} /> : <Notes notes={notes} allDone={allDone} />,
    nudges: <Nudges profile={profile} update={update} />,
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

      <BottomNav tab={tab} onChange={setTab} notesDot={!isAdmin && notes.hasNew} />

      <AnimatePresence>
        {showCelebration && (
          <DayComplete key="done" notes={notes} total={total} onClose={closeCelebration} />
        )}
      </AnimatePresence>
    </>
  )
}
