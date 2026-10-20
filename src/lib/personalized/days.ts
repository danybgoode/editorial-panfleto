// Calendar days for "Antes de hoy": the edition is the last 24 hours, and everything older is read one
// calendar day at a time, in the newsroom's time zone (the one formatEditorialDate prints in).
//
// Pure and import-free, so the specs run it without Next.

export const EDITION_TIME_ZONE = 'America/Mexico_City'

const DAY_MS = 24 * 60 * 60 * 1000

const partsOf = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return {
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    month: get('month'),
    second: get('second'),
    year: get('year'),
  }
}

// How far the zone's wall clock is ahead of UTC at this instant.
const offsetAt = (instant: number, timeZone: string) => {
  const p = partsOf(instant, timeZone)
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return wall - Math.floor(instant / 1000) * 1000
}

export const dayKeyOf = (instant: number, timeZone = EDITION_TIME_ZONE) => {
  const p = partsOf(instant, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

// The instant the zone's calendar day holding `instant` began. Measured twice, so a DST change on that day
// lands on the right side.
export const startOfDay = (instant: number, timeZone = EDITION_TIME_ZONE) => {
  const p = partsOf(instant, timeZone)
  const midnightWall = Date.UTC(p.year, p.month - 1, p.day)
  const guess = midnightWall - offsetAt(midnightWall, timeZone)
  return midnightWall - offsetAt(guess, timeZone)
}

// "Hoy", then "Ayer, lunes 19 de octubre" for yesterday, "Domingo 18 de octubre" before that.
export const dayLabel = (dayStart: number, now: number, timeZone = EDITION_TIME_ZONE) => {
  if (dayKeyOf(dayStart, timeZone) === dayKeyOf(now, timeZone)) return 'Hoy'
  const formatted = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone,
    weekday: 'long',
  })
    .format(new Date(dayStart + DAY_MS / 2))
    .replace(',', '')
  const yesterday = dayKeyOf(startOfDay(now, timeZone) - 1, timeZone)
  if (dayKeyOf(dayStart, timeZone) === yesterday) return `Ayer, ${formatted}`
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
