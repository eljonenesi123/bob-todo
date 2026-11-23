import { useEffect, useState } from 'react'

// How much of the screen isn't covered by the phone's keyboard, in px; null while nothing covers it.
// iPhones lay the keyboard over the page without telling CSS, which would hide a form at the bottom.
export function useVisibleHeight() {
  const [height, setHeight] = useState(null)
  useEffect(() => {
    const view = window.visualViewport
    if (!view) return
    const measure = () => {
      // A zoomed page is smaller too, but that's not a keyboard
      const covered = view.scale < 1.05 && window.innerHeight - view.height > 100
      setHeight(covered ? Math.round(view.height) : null)
    }
    measure()
    view.addEventListener('resize', measure)
    return () => view.removeEventListener('resize', measure)
  }, [])
  // With the page shorter there is nothing left to scroll to
  useEffect(() => { if (height) window.scrollTo(0, 0) }, [height])
  return height
}
