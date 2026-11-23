import { useSyncExternalStore } from 'react'
import { onOutbox, outboxState } from '../lib/outbox'

function onLine(listener) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

// { offline, pending }: is there a connection, and how many changes still wait on this device
export function useConnection() {
  const { pending, stuck } = useSyncExternalStore(onOutbox, outboxState)
  const online = useSyncExternalStore(onLine, () => navigator.onLine)
  return { offline: !online || (stuck && pending > 0), pending }
}
