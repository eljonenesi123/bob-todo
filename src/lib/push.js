import { supabase } from './supabase'
import { notificationsSupported } from './pwa'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function base64ToUint8(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function saveSubscription(sub) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You’re signed out. Sign in again, then try.')
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' }
  )
  if (error) throw new Error(error.message)
}

// Is this phone's subscription stored under the signed-in account? (RLS only shows own rows)
async function isSaved(sub) {
  const { data, error } = await supabase.from('push_subscriptions')
    .select('id').eq('endpoint', sub.endpoint).maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

const subscribe = (reg) => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(VAPID_PUBLIC_KEY) })

export async function getSubscription() {
  if (!notificationsSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Make sure this phone is subscribed AND saved for the signed-in account.
// If the old subscription can't be saved (e.g. it belongs to another account that
// used this phone before), throw it away and start a fresh one.
async function connect() {
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY is missing from this build')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (sub) {
    try {
      await saveSubscription(sub)
      if (await isSaved(sub)) return
    } catch { /* fall through to a fresh subscription */ }
    await sub.unsubscribe().catch(() => {})
  }
  sub = await subscribe(reg)
  await saveSubscription(sub)
  if (!(await isSaved(sub))) throw new Error('Bob couldn’t save this device.')
}

// Ask permission, subscribe this device, save it so the server can send nudges
export async function enablePush() {
  if (!notificationsSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  await connect()
  return 'granted'
}

export async function disablePush() {
  const sub = await getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

// The real state of this device: 'on' only when Bob's server can actually reach it
export async function deviceStatus() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'granted') return Notification.permission
  const sub = await getSubscription()
  if (!sub) return 'off'
  return (await isSaved(sub)) ? 'on' : 'not-saved'
}

// On every app start: re-save this device (browsers rotate subscriptions).
// Returns false when notifications are allowed but the device couldn't be connected.
export async function syncPush() {
  try {
    if (!notificationsSupported() || Notification.permission !== 'granted' || !VAPID_PUBLIC_KEY) return true
    await connect()
    return true
  } catch (e) {
    console.warn('Push sync failed', e)
    return false
  }
}
