// Original lines, one per day. Add your own anytime.
const QUOTES = [
  'Small steps still move you forward. Start with one.',
  'You don’t have to do it all. Just the next thing.',
  'Done is better than perfect. Tick one off.',
  'Future you is already proud. Keep going.',
  'One task at a time is still a whole day of progress.',
  'Start messy. Finish anyway.',
  'Your pace is the right pace.',
  'Five focused minutes beat an hour of worrying.',
  'Hard things first, then the fun stuff tastes better.',
  'You’ve handled every hard day so far. This one too.',
  'Progress loves a tiny start.',
  'Be the reason today goes well.',
  'Breathe, pick one, begin.',
  'Little wins add up to big days.',
  'Today counts, even the quiet parts.',
  'Make it easy for yourself: smallest step first.',
  'You’re doing better than you think.',
  'Momentum starts with one checkmark.',
  'Focus on the next tick, not the whole list.',
  'Rest is part of the plan too.',
]

// Counted on calendar dates (not clock time), exactly like quoteFor() in the Edge Function,
// so summer time can't make the app and the morning push disagree.
export function quoteOfTheDay(d = new Date()) {
  const dayOfYear = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000)
  return QUOTES[dayOfYear % QUOTES.length]
}
