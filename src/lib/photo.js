import { supabase } from './supabase'

const BUCKET = 'letter-photos'
const MAX_SIDE = 1600
const photos = () => supabase.storage.from(BUCKET)

// A smaller JPEG of a picked photo. Drawing it again also drops what the phone stored
// in the file, like the place where it was taken.
export async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff' // see-through pictures would turn black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('The photo could not be read')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Answers the place it was saved
export async function uploadPhoto(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await photos().upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return path
}

// Best effort: a leftover file is private and harmless
export async function deletePhoto(path) {
  if (path) await photos().remove([path]).catch(() => {})
}

// A link that works for an hour
export async function photoUrl(path) {
  const { data, error } = await photos().createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

// Save a letter with its photo: the photo first, and if the letter then fails, the photo goes again.
// `photo` is a blob or null. Answers the saved letter.
export async function sendLetter(userId, row, photo) {
  const path = photo ? await uploadPhoto(userId, photo) : null
  const { data, error } = await supabase.from('notes').insert(path ? { ...row, photo_path: path } : row).select().single()
  if (error) {
    await deletePhoto(path)
    throw error
  }
  return data
}

// For places with only room for words
export const letterWords = (letter) => letter.body || (letter.photo_path ? 'A photo' : '')
