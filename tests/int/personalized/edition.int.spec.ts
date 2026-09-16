// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  DAY_MS,
  editionKey,
  FRESH_MS,
  FULL_MAX_AGE_MS,
  loadEdition,
  type EditionSource,
} from '@/lib/personalized/edition'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import type { ReaderEntry } from '@/lib/personalized/reader'
import { createMemoryStore } from '@/lib/personalized/store'

// Sprint 2 (fluxonline personalized-edition): a reader's day is built once, refreshed by delta, and can never
// be served to another reader.

const NOW = Date.UTC(2026, 8, 16, 12)
const hoursAgo = (hours: number, from = NOW) => new Date(from - hours * 3_600_000).toISOString()

const entry = (id: number, title: string, overrides: Partial<ReaderEntry> = {}): ReaderEntry => ({
  content: `<p>${title}</p>`,
  feed: {
    category: { title: 'News' },
    site_url: `https://feed${id}.example.com`,
    title: `Feed ${id}`,
  },
  feed_id: id,
  id,
  published_at: hoursAgo(1),
  title,
  url: `https://feed${id}.example.com/${id}`,
  ...overrides,
})

const sourceOf = (entries: ReaderEntry[]) => {
  const fetchEntriesPage = vi.fn(
    async ({ afterEntryId }: { afterEntryId: number; publishedAfter: number }) =>
      entries.filter((item) => item.id > afterEntryId),
  )
  const fetchHackerNewsComments = vi.fn(async () => 0)
  return { fetchEntriesPage, fetchHackerNewsComments } satisfies EditionSource
}

const titles = (result: { edition: { front: Array<{ title: string }> } }) =>
  result.edition.front.map((s) => s.title)

describe("a reader's day is built once and reused (2.1)", () => {
  it('builds on the first view, then serves a fresh edition with no call to panfleto', async () => {
    const store = createMemoryStore(() => NOW)
    const source = sourceOf([entry(1, 'Primera historia del día')])

    const first = await loadEdition({ now: NOW, reader: { userId: 2 }, source, store })
    expect(first.state).toBe('built')
    expect(source.fetchEntriesPage).toHaveBeenCalledWith({
      afterEntryId: 0,
      publishedAfter: Math.floor((NOW - DAY_MS) / 1000),
    })

    source.fetchEntriesPage.mockClear()
    const second = await loadEdition({
      now: NOW + FRESH_MS - 1,
      reader: { userId: 2 },
      source,
      store,
    })
    expect(second.state).toBe('fresh')
    expect(titles(second)).toEqual(['Primera historia del día'])
    expect(source.fetchEntriesPage).not.toHaveBeenCalled()
  })

  it('pages through a day bigger than one request allows', async () => {
    const store = createMemoryStore(() => NOW)
    const day = Array.from({ length: 1500 }, (_, index) =>
      entry(index + 1, `Historia número ${index + 1}`),
    )
    const source = sourceOf(day)
    source.fetchEntriesPage.mockImplementation(async ({ afterEntryId }) =>
      day.filter((item) => item.id > afterEntryId).slice(0, 1000),
    )

    const result = await loadEdition({ now: NOW, reader: { userId: 2 }, source, store })
    expect(result.edition.entryCount).toBe(1500)
    expect(source.fetchEntriesPage.mock.calls.map(([params]) => params.afterEntryId)).toEqual([
      0, 1000,
    ])
  })
})

describe('the edition refreshes incrementally (2.2)', () => {
  it('serves the stale copy at once, then fetches only entries stored since the last build', async () => {
    const store = createMemoryStore(() => NOW)
    const source = sourceOf([entry(10, 'Historia vieja pero vigente')])
    await loadEdition({ now: NOW, reader: { userId: 2 }, source, store })

    // A late arrival: stored after the last build (higher ID) but published five hours earlier.
    const later = NOW + FRESH_MS + 1
    source.fetchEntriesPage.mockReset()
    source.fetchEntriesPage.mockResolvedValue([
      entry(11, 'Llegó tarde al lector', { published_at: hoursAgo(5, later) }),
    ])

    const stale = await loadEdition({ now: later, reader: { userId: 2 }, source, store })
    expect(stale.state).toBe('stale')
    expect(titles(stale)).toEqual(['Historia vieja pero vigente'])
    expect(source.fetchEntriesPage).not.toHaveBeenCalled()

    await stale.refresh?.()
    expect(source.fetchEntriesPage).toHaveBeenCalledTimes(1)
    expect(source.fetchEntriesPage).toHaveBeenCalledWith({
      afterEntryId: 10,
      publishedAfter: Math.floor((later - DAY_MS) / 1000),
    })

    const refreshed = await loadEdition({ now: later + 1, reader: { userId: 2 }, source, store })
    expect(refreshed.state).toBe('fresh')
    expect(refreshed.edition.entryCount).toBe(2)
    expect(titles(refreshed)).toContain('Llegó tarde al lector')
  })

  it('rebuilds the whole day once the edition is older than the max age', async () => {
    const store = createMemoryStore(() => NOW)
    const source = sourceOf([entry(10, 'Historia de la mañana')])
    await loadEdition({ now: NOW, reader: { userId: 2 }, source, store })

    source.fetchEntriesPage.mockClear()
    const stale = await loadEdition({
      now: NOW + FULL_MAX_AGE_MS,
      reader: { userId: 2 },
      source,
      store,
    })
    await stale.refresh?.()
    expect(source.fetchEntriesPage.mock.calls[0][0].afterEntryId).toBe(0)
  })

  it('drops the edition when panfleto rejects the token during a refresh', async () => {
    const store = createMemoryStore(() => NOW)
    const source = sourceOf([entry(10, 'Historia')])
    await loadEdition({ now: NOW, reader: { userId: 2 }, source, store })

    source.fetchEntriesPage.mockRejectedValue(new MinifluxRequestError(401, 'Access Unauthorized'))
    const stale = await loadEdition({ now: NOW + FRESH_MS, reader: { userId: 2 }, source, store })
    await stale.refresh?.()
    expect(await store.get(editionKey(2))).toBeNull()
  })
})

describe("one reader's edition is never served to another (2.3)", () => {
  it('keys editions by reader, and a warm edition for one reader never answers for the other', async () => {
    expect(editionKey(2)).not.toBe(editionKey(3))
    expect(editionKey(2, 'preview')).not.toBe(editionKey(2, 'production'))

    const store = createMemoryStore(() => NOW)
    const readerA = sourceOf([entry(1, 'Solo para la lectora A')])
    const readerB = sourceOf([entry(2, 'Solo para el lector B')])

    await loadEdition({ now: NOW, reader: { userId: 2 }, source: readerA, store })
    const b = await loadEdition({ now: NOW + 1, reader: { userId: 3 }, source: readerB, store })

    expect(b.state).toBe('built')
    expect(titles(b)).toEqual(['Solo para el lector B'])
    expect(readerA.fetchEntriesPage).toHaveBeenCalledTimes(1)
  })

  it('rebuilds rather than trusting a stored edition that belongs to someone else', async () => {
    const store = createMemoryStore(() => NOW)
    await loadEdition({
      now: NOW,
      reader: { userId: 2 },
      source: sourceOf([entry(1, 'De A')]),
      store,
    })
    await store.set(editionKey(3), (await store.get(editionKey(2))) as string, 60)

    const b = await loadEdition({
      now: NOW + 1,
      reader: { userId: 3 },
      source: sourceOf([entry(2, 'De B')]),
      store,
    })
    expect(b.state).toBe('built')
    expect(titles(b)).toEqual(['De B'])
  })
})
