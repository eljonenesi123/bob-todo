// Helpers for installing Bob and checking notification support

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const notificationsSupported = () =>
  'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

// Chrome/Edge fire this when the app can be installed; we keep it for our own button
let deferredPrompt = null
const listeners = new Set()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  listeners.forEach((fn) => fn(true))
})
window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  listeners.forEach((fn) => fn(false))
})

export const canPromptInstall = () => deferredPrompt !== null
export const onInstallAvailable = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  listeners.forEach((fn) => fn(false))
  return outcome === 'accepted'
}

const SETUP_KEY = 'bob-setup-done'
export function setupDone() {
  try { return localStorage.getItem(SETUP_KEY) === '1' } catch { return false }
}
export function markSetupDone() {
  try { localStorage.setItem(SETUP_KEY, '1') } catch { /* private mode: show setup again next time */ }
}
