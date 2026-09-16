import { MinifluxRequestError, minifluxFetchAs } from '../miniflux/client'
import { isPlausibleToken } from './session'

// Reading AS a reader, with their own key. Every outcome that matters to them is split out: "the token is
// wrong" tells them to replace it, so it must never be what an outage looks like (LEARNINGS 2026-09-16).

export type ReaderIdentity =
  | { kind: 'malformed' }
  | { kind: 'ok'; userId: number; username: string }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }

export const isUnauthorizedError = (error: unknown) =>
  error instanceof MinifluxRequestError && (error.status === 401 || error.status === 403)

export const identifyReader = async (token: string): Promise<ReaderIdentity> => {
  if (!isPlausibleToken(token)) return { kind: 'malformed' }

  try {
    const me = await minifluxFetchAs<{ id?: unknown; username?: unknown }>(token, '/me')

    if (typeof me.id !== 'number' || typeof me.username !== 'string') return { kind: 'unavailable' }

    return { kind: 'ok', userId: me.id, username: me.username }
  } catch (error) {
    if (isUnauthorizedError(error)) return { kind: 'unauthorized' }

    console.error('[tu-edicion] panfleto /v1/me unavailable', {
      status: error instanceof MinifluxRequestError ? error.status : 'transport',
    })

    return { kind: 'unavailable' }
  }
}

// The fields of /v1/entries the edition reads. `content` is only measured and cut to an excerpt; it is never
// stored (the API has no field selection, so it still has to be downloaded).
export type ReaderEntry = {
  comments_url?: string
  content?: string
  feed: {
    category?: { title?: string }
    feed_url?: string
    site_url?: string
    title?: string
  }
  feed_id: number
  id: number
  published_at: string
  reading_time?: number
  title: string
  url: string
}

export const ENTRIES_PAGE_LIMIT = 1000

// One page of a reader's entries stored after `afterEntryId` and published after `publishedAfter` (unix
// seconds), oldest ID first, so the caller can page by ID. Miniflux refuses limit > 1000.
export const fetchReaderEntriesPage = async (
  token: string,
  { afterEntryId, publishedAfter }: { afterEntryId: number; publishedAfter: number },
): Promise<ReaderEntry[]> => {
  const params = new URLSearchParams({
    direction: 'asc',
    limit: String(ENTRIES_PAGE_LIMIT),
    order: 'id',
    published_after: String(publishedAfter),
  })
  params.append('status', 'unread')
  params.append('status', 'read')
  if (afterEntryId > 0) params.set('after_entry_id', String(afterEntryId))

  const data = await minifluxFetchAs<{ entries?: ReaderEntry[] }>(
    token,
    `/entries?${params.toString()}`,
  )
  return data.entries || []
}

const HN_TIMEOUT_MS = 3000

// Comment count for one Hacker News item, or 0 when HN doesn't answer in time: a missing signal must not
// cost the reader their edition.
export const fetchHackerNewsComments = async (itemId: string): Promise<number> => {
  try {
    const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${itemId}.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HN_TIMEOUT_MS),
    })
    if (!response.ok) return 0
    const item = (await response.json()) as { descendants?: unknown } | null
    return typeof item?.descendants === 'number' ? item.descendants : 0
  } catch {
    return 0
  }
}
