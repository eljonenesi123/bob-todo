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
  if (!user) return
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'endpoint' }
  )
}

export async function getSubscription() {
  if (!notificationsSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Ask permission, subscribe this device, save it so the server can send nudges
export async function enablePush() {
  if (!notificationsSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VITE_VAPID_PUBLIC_KEY is missing')
    return 'granted'
  }
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(VAPID_PUBLIC_KEY) }))
  await saveSubscription(sub)
  return 'granted'
}

export async function disablePush() {
  const sub = await getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

// On every app start: re-save this device's subscription (browsers rotate them)
export async function syncPush() {
  try {
    if (!notificationsSupported() || Notification.permission !== 'granted' || !VAPID_PUBLIC_KEY) return
    const sub = await getSubscription()
    if (sub) await saveSubscription(sub)
    else await enablePush()
  } catch (e) {
    console.warn('Push sync failed', e)
  }
}
