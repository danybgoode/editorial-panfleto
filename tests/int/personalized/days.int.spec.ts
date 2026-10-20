// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { dayKeyOf, dayLabel, startOfDay } from '@/lib/personalized/days'

// "Antes de hoy" reads one calendar day at a time in the newsroom's zone (America/Mexico_City, UTC-6).

const NOW = Date.UTC(2026, 9, 20, 18) // Tue 20 Oct 2026, 12:00 in Mexico City

describe('calendar days in the edition time zone', () => {
  it('starts a day at local midnight, not UTC midnight', () => {
    const start = startOfDay(NOW)
    expect(new Date(start).toISOString()).toBe('2026-10-20T06:00:00.000Z')
    expect(dayKeyOf(start)).toBe('2026-10-20')
    expect(dayKeyOf(start - 1)).toBe('2026-10-19')
  })

  it('puts late-evening local entries on their own day even when UTC has moved on', () => {
    expect(dayKeyOf(Date.UTC(2026, 9, 20, 4))).toBe('2026-10-19')
  })

  it('is exact across a daylight-saving change', () => {
    // New York leaves DST on Sun 1 Nov 2026: that midnight is still EDT (UTC-4).
    expect(new Date(startOfDay(Date.UTC(2026, 10, 1, 18), 'America/New_York')).toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    )
    expect(new Date(startOfDay(Date.UTC(2026, 10, 2, 18), 'America/New_York')).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    )
  })

  it('labels today, yesterday and older days the way the page reads them', () => {
    const today = startOfDay(NOW)
    expect(dayLabel(today, NOW)).toBe('Hoy')
    expect(dayLabel(startOfDay(today - 1), NOW)).toBe('Ayer, lunes 19 de octubre')
    expect(dayLabel(startOfDay(startOfDay(today - 1) - 1), NOW)).toBe('Domingo 18 de octubre')
  })
})
