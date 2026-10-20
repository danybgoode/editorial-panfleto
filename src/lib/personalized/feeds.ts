import { type MinifluxFeed, minifluxFetchAs } from '../miniflux/client'
import { dayKeyOf, dayLabel, EDITION_TIME_ZONE, startOfDay } from './days'
import { toSlimEntry } from './edition'
import { decodeEntities } from './ranking'
import type { ReaderEntry } from './reader'

// The reader's own feeds, read AS the reader: the Fuentes index, one source's page, and the days before the
// edition. Each call asks panfleto for exactly the page it shows, never the whole archive.

const FEEDS_TIMEOUT_MS = 10000
const ENTRIES_TIMEOUT_MS = 15000

export const FEED_PAGE_SIZE = 24
export const DAY_LIMIT = 100
// An empty day is skipped rather than shown; this bounds how many one request walks past.
const MAX_EMPTY_DAYS = 7

export type ReaderFeed = {
  category: string
  id: number
  siteUrl: string
  title: string
}

// An entry as a list shows it: no body, so a page of them stays small.
export type ListedEntry = {
  category: string
  excerpt: string
  feedId: number
  feedTitle: string
  id: number
  imageUrl?: string
  publishedAt: string
  readingTime: number
  title: string
  unread: boolean
  url: string
}

type EntriesResponse = { entries?: (ReaderEntry & { status?: string })[]; total?: number }

const toFeed = (feed: MinifluxFeed): ReaderFeed => ({
  category: feed.category?.title || 'Sin categoría',
  id: feed.id,
  siteUrl: feed.site_url || feed.feed_url || '',
  title: feed.title,
})

const toListed = (entry: ReaderEntry & { status?: string }): ListedEntry => {
  const slim = toSlimEntry(entry)
  return {
    category: slim.categoryTitle,
    excerpt: slim.excerpt,
    feedId: slim.feedId,
    feedTitle: slim.feedTitle,
    id: slim.id,
    imageUrl: slim.imageUrl,
    publishedAt: slim.publishedAt,
    readingTime: slim.readingTime,
    title: decodeEntities(slim.title),
    unread: entry.status === 'unread',
    url: slim.url,
  }
}

export const fetchReaderFeeds = async (token: string): Promise<ReaderFeed[]> => {
  const feeds = await minifluxFetchAs<MinifluxFeed[]>(token, '/feeds', {
    timeoutMs: FEEDS_TIMEOUT_MS,
  })
  return feeds.map(toFeed)
}

export const fetchReaderFeed = async (token: string, feedId: number): Promise<ReaderFeed> =>
  toFeed(
    await minifluxFetchAs<MinifluxFeed>(token, `/feeds/${feedId}`, { timeoutMs: FEEDS_TIMEOUT_MS }),
  )

export const fetchReaderUnreadCounts = async (token: string): Promise<Record<string, number>> => {
  const counters = await minifluxFetchAs<{ unreads?: Record<string, number> }>(
    token,
    '/feeds/counters',
    { timeoutMs: FEEDS_TIMEOUT_MS },
  )
  return counters.unreads || {}
}

export type FeedEntriesPage = {
  entries: ListedEntry[]
  // The entry ID to read before for the next page; null when this was the last.
  nextCursor: null | number
  total: number
}

// Newest first by entry ID, so the cursor never skips or repeats an entry the way a timestamp tie could.
export const fetchReaderFeedEntries = async (
  token: string,
  feedId: number,
  {
    beforeEntryId,
    limit = FEED_PAGE_SIZE,
    unreadOnly = false,
  }: { beforeEntryId?: number; limit?: number; unreadOnly?: boolean } = {},
): Promise<FeedEntriesPage> => {
  const params = new URLSearchParams({ direction: 'desc', limit: String(limit), order: 'id' })
  params.append('status', 'unread')
  if (!unreadOnly) params.append('status', 'read')
  if (beforeEntryId) params.set('before_entry_id', String(beforeEntryId))

  const data = await minifluxFetchAs<EntriesResponse>(
    token,
    `/feeds/${feedId}/entries?${params.toString()}`,
    { timeoutMs: ENTRIES_TIMEOUT_MS },
  )
  const entries = (data.entries || []).map(toListed)
  const last = entries[entries.length - 1]

  return {
    entries,
    nextCursor: entries.length === limit && last ? last.id : null,
    total: data.total ?? entries.length,
  }
}

export type ReaderDay = {
  entries: ListedEntry[]
  key: string
  label: string
  total: number
}

export type ReaderDaysPage = {
  day: null | ReaderDay
  // Read the next older day before this instant (ms); null once MAX_EMPTY_DAYS in a row were empty.
  next: null | number
}

// The newest non-empty calendar day that ends at or before `before`. The first call passes the edition's
// own window start, so a day already partly in the edition shows only what the edition left out.
export const fetchReaderDay = async (
  token: string,
  { before, now = Date.now(), timeZone = EDITION_TIME_ZONE }: { before: number; now?: number; timeZone?: string },
): Promise<ReaderDaysPage> => {
  let end = before

  for (let walked = 0; walked < MAX_EMPTY_DAYS; walked++) {
    const start = startOfDay(end - 1, timeZone)
    const params = new URLSearchParams({
      direction: 'desc',
      limit: String(DAY_LIMIT),
      order: 'published_at',
      published_after: String(Math.floor(start / 1000) - 1),
      published_before: String(Math.floor(end / 1000)),
    })
    params.append('status', 'unread')
    params.append('status', 'read')

    const data = await minifluxFetchAs<EntriesResponse>(token, `/entries?${params.toString()}`, {
      timeoutMs: ENTRIES_TIMEOUT_MS,
    })
    const entries = (data.entries || []).map(toListed)

    if (entries.length > 0) {
      return {
        day: {
          entries,
          key: dayKeyOf(start, timeZone),
          label: dayLabel(start, now, timeZone),
          total: data.total ?? entries.length,
        },
        next: start,
      }
    }
    end = start
  }

  return { day: null, next: null }
}
