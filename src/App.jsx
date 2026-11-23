import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { supabase } from './lib/supabase'
import { setupDone } from './lib/pwa'
import { storedSession } from './lib/session'
import { clearCache } from './lib/cache'
import TasksProvider from './context/TasksProvider'
import Welcome from './screens/Welcome'
import Setup from './screens/Setup'
import Shell from './Shell'
import Splash from './components/Splash'

// How long the opening screen stays at least: long enough to read the quote, short enough not to wait
const SPLASH_MS = 1600

export default function App() {
  // Without a connection an old session can't be renewed, but Bob still opens with what it last saw
  const [session, setSession] = useState(storedSession)
  const [loading, setLoading] = useState(() => !storedSession())
  const [needsSetup, setNeedsSetup] = useState(() => !setupDone())
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? storedSession())
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') clearCache()
      setSession(s ?? (event === 'SIGNED_OUT' ? null : storedSession()))
    })
    return () => subscription.unsubscribe()
  }, [])

  // The app loads underneath the splash, so her list is ready when it fades away
  let screen = null
  if (!loading) {
    if (!session) screen = <Welcome />
    else if (needsSetup) screen = <Setup onDone={() => setNeedsSetup(false)} />
    else screen = (
      <TasksProvider key={session.user.id} userId={session.user.id}>
        <Shell user={session.user} />
      </TasksProvider>
    )
  }

  return (
    <>
      {screen}
      <AnimatePresence>{(loading || !splashDone) && <Splash key="splash" />}</AnimatePresence>
    </>
  )
}
