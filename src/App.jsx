import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { setupDone } from './lib/pwa'
import TasksProvider from './context/TasksProvider'
import Welcome from './screens/Welcome'
import Setup from './screens/Setup'
import Shell from './Shell'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(() => !setupDone())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Welcome />
  if (needsSetup) return <Setup onDone={() => setNeedsSetup(false)} />
  return (
    <TasksProvider key={session.user.id}>
      <Shell user={session.user} />
    </TasksProvider>
  )
}
