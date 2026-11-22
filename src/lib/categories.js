export const CATEGORIES = [
  { id: 'study', label: 'Study' },
  { id: 'work', label: 'Work' },
  { id: 'health', label: 'Health' },
  { id: 'home', label: 'Home' },
  { id: 'personal', label: 'Personal' },
]
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? ''

export const REPEATS = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Weekly' },
]
