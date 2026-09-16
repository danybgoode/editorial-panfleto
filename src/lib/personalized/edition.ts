import { gunzipSync, gzipSync } from 'node:zlib'

import { hackerNewsItemId, makeExcerpt, rankEdition, type Edition, type SlimEntry } from './ranking'
import {
  ENTRIES_PAGE_LIMIT,
  isUnauthorizedError,
  type ReaderEntry,
  type ReaderIdentity,
} from './reader'
import type { ReaderSession } from './session'
import type { EditionStore } from './store'

// A reader's day, built once and reused (fluxonline personalized-edition D1b, D5, D6).
//
// - No stored edition: build the day inline. This is the only blocking fetch.
// - Before any of that, the key in the session must be one panfleto still accepts FOR THIS USER, checked
//   against /v1/me at most every KEY_CHECK_TTL_SECONDS. So a revoked or rotated token stops reading within
//   that window however fresh the edition is kept by someone else's views, and a session can only ever
//   read the edition of the user its own key belongs to.
// - Stored and younger than FRESH_MS: serve it with no call for entries.
// - Stored and older: serve it now, and hand back a refresh for the caller to run after the response.
//   The refresh asks only for entries STORED since the last build (`after_entry_id`), which also catches the
//   late arrivals a `published_after` delta would miss. Past FULL_MAX_AGE_MS it rebuilds the whole day, so
//   edits, removals and grown comment counts come in too.
//
// Store, fetchers and clock are arguments, so the specs run this without a network.

export const FRESH_MS = 10 * 60 * 1000
export const FULL_MAX_AGE_MS = 6 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000
const STORE_TTL_SECONDS = 48 * 60 * 60
const LOCK_TTL_SECONDS = 120
const MAX_PAGES = 5
const HN_CONCURRENCY = 8
// All HN lookups in one build share this budget; anything unfetched counts 0 until the next rebuild.
const HN_BUDGET_MS = 4000
export const KEY_CHECK_TTL_SECONDS = 10 * 60

export type EditionSource = {
  fetchEntriesPage: (params: {
    afterEntryId: number
    publishedAfter: number
  }) => Promise<ReaderEntry[]>
  fetchHackerNewsComments: (itemId: string) => Promise<number>
  identify: () => Promise<ReaderIdentity>
}

export type StoredEdition = {
  builtAt: number
  edition: Edition
  entries: SlimEntry[]
  fullBuiltAt: number
  hnComments: Record<string, number>
  newestEntryId: number
  userId: number
  v: 1
}

export type EditionResult = {
  builtAt: number
  edition: Edition
  refresh?: () => Promise<void>
  state: 'built' | 'fresh' | 'stale'
}

// panfleto could not be asked (outage, timeout, a proxy in front of it refusing Vercel). Not the token's fault.
export class ReaderUnavailable extends Error {
  constructor() {
    super('panfleto is not answering')
    this.name = 'ReaderUnavailable'
  }
}

export class ReaderTokenRejected extends Error {
  constructor() {
    super('panfleto rejected the reader token')
    this.name = 'ReaderTokenRejected'
  }
}

// The reader's Miniflux user ID is the identity; it came from /v1/me and sits inside the sealed cookie.
// The environment keeps Preview's editions out of Production's, which share one Upstash database.
export const editionKey = (userId: number, environment = process.env.VERCEL_ENV || 'development') =>
  `pe:v1:${environment}:edition:${userId}`

const lockKey = (userId: number, environment?: string) => `${editionKey(userId, environment)}:lock`

// Records "this key was accepted for this user" under an HMAC of the key, never the key itself.
const keyCheckKey = (
  keyFingerprint: string,
  environment = process.env.VERCEL_ENV || 'development',
) => `pe:v1:${environment}:key:${keyFingerprint}`

const encode = (stored: StoredEdition) => gzipSync(JSON.stringify(stored)).toString('base64')

const decode = (value: null | string): StoredEdition | null => {
  if (!value) return null
  try {
    const stored = JSON.parse(
      gunzipSync(Buffer.from(value, 'base64')).toString('utf8'),
    ) as StoredEdition
    return stored.v === 1 ? stored : null
  } catch {
    return null
  }
}

export const toSlimEntry = (entry: ReaderEntry): SlimEntry => ({
  categoryTitle: entry.feed.category?.title || 'Sin categoría',
  commentsUrl: entry.comments_url || '',
  contentLength: (entry.content || '').length,
  excerpt: makeExcerpt(entry.content || ''),
  feedId: entry.feed_id,
  feedTitle: entry.feed.title || '',
  id: entry.id,
  publishedAt: entry.published_at,
  readingTime: entry.reading_time || 0,
  siteUrl: entry.feed.site_url || entry.feed.feed_url || '',
  title: entry.title,
  url: entry.url,
})

const fetchSince = async (source: EditionSource, afterEntryId: number, now: number) => {
  const publishedAfter = Math.floor((now - DAY_MS) / 1000)
  const entries: SlimEntry[] = []
  let cursor = afterEntryId

  for (let page = 0; page < MAX_PAGES; page++) {
    let batch: ReaderEntry[]
    try {
      batch = await source.fetchEntriesPage({ afterEntryId: cursor, publishedAfter })
    } catch (error) {
      if (isUnauthorizedError(error)) throw new ReaderTokenRejected()
      throw error
    }
    entries.push(...batch.map(toSlimEntry))
    if (batch.length < ENTRIES_PAGE_LIMIT) break
    cursor = Math.max(cursor, ...batch.map((entry) => entry.id))
  }

  return entries
}

const fetchCommentCounts = async (source: EditionSource, entries: SlimEntry[]) => {
  const wanted = entries.flatMap((entry) => {
    const itemId = hackerNewsItemId(entry.commentsUrl)
    return itemId ? [{ entryId: String(entry.id), itemId }] : []
  })
  const counts: Record<string, number> = {}
  const deadline = Date.now() + HN_BUDGET_MS

  for (let index = 0; index < wanted.length; index += HN_CONCURRENCY) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await Promise.all(
      wanted.slice(index, index + HN_CONCURRENCY).map(async ({ entryId, itemId }) => {
        const count = await Promise.race([
          source.fetchHackerNewsComments(itemId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
        ])
        if (typeof count === 'number') counts[entryId] = count
      }),
    )
  }

  return counts
}

const assemble = ({
  entries,
  fullBuiltAt,
  hnComments,
  now,
  userId,
}: {
  entries: SlimEntry[]
  fullBuiltAt: number
  hnComments: Record<string, number>
  now: number
  userId: number
}): StoredEdition => ({
  builtAt: now,
  edition: rankEdition({ entries, hnComments, now }),
  entries,
  fullBuiltAt,
  hnComments,
  newestEntryId: entries.reduce((newest, entry) => Math.max(newest, entry.id), 0),
  userId,
  v: 1,
})

export const buildFullEdition = async (userId: number, source: EditionSource, now: number) => {
  const entries = await fetchSince(source, 0, now)
  return assemble({
    entries,
    fullBuiltAt: now,
    hnComments: await fetchCommentCounts(source, entries),
    now,
    userId,
  })
}

export const refreshEditionIncrementally = async (
  stored: StoredEdition,
  source: EditionSource,
  now: number,
) => {
  const arrived = await fetchSince(source, stored.newestEntryId, now)
  const byId = new Map(stored.entries.map((entry) => [entry.id, entry]))
  for (const entry of arrived) byId.set(entry.id, entry)

  const dayStart = now - DAY_MS
  const entries = [...byId.values()].filter(
    (entry) => new Date(entry.publishedAt).getTime() > dayStart,
  )
  const kept = new Set(entries.map((entry) => String(entry.id)))
  const hnComments = Object.fromEntries(
    Object.entries(stored.hnComments).filter(([id]) => kept.has(id)),
  )
  Object.assign(hnComments, await fetchCommentCounts(source, arrived))

  const next = assemble({
    entries,
    fullBuiltAt: stored.fullBuiltAt,
    hnComments,
    now,
    userId: stored.userId,
  })
  // Keep the high-water mark even if everything past it has aged out of the day.
  next.newestEntryId = Math.max(next.newestEntryId, stored.newestEntryId)
  return next
}

export const loadEdition = async ({
  environment,
  now,
  reader,
  source,
  store,
}: {
  environment?: string
  now: number
  reader: Pick<ReaderSession, 'userId'> & { keyFingerprint: string }
  source: EditionSource
  store: EditionStore
}): Promise<EditionResult> => {
  const key = editionKey(reader.userId, environment)
  const checked = keyCheckKey(reader.keyFingerprint, environment)

  if ((await store.get(checked).catch(() => null)) !== String(reader.userId)) {
    const identity = await source.identify()
    if (identity.kind === 'unavailable') throw new ReaderUnavailable()
    if (identity.kind !== 'ok' || identity.userId !== reader.userId) throw new ReaderTokenRejected()
    await store.set(checked, String(reader.userId), KEY_CHECK_TTL_SECONDS).catch(() => undefined)
  }
  const stored = decode(await store.get(key).catch(() => null))

  if (!stored || stored.userId !== reader.userId) {
    const built = await buildFullEdition(reader.userId, source, now)
    await store.set(key, encode(built), STORE_TTL_SECONDS).catch((error) => {
      console.error('[tu-edicion] could not store an edition', { message: String(error) })
    })
    return { builtAt: built.builtAt, edition: built.edition, state: 'built' }
  }

  if (now - stored.builtAt < FRESH_MS) {
    return { builtAt: stored.builtAt, edition: stored.edition, state: 'fresh' }
  }

  const refresh = async () => {
    const lock = lockKey(reader.userId, environment)
    let owner: null | string = null
    try {
      owner = await store.acquireLock(lock, LOCK_TTL_SECONDS)
      if (!owner) return
      const next =
        now - stored.fullBuiltAt >= FULL_MAX_AGE_MS
          ? await buildFullEdition(reader.userId, source, now)
          : await refreshEditionIncrementally(stored, source, now)
      await store.set(key, encode(next), STORE_TTL_SECONDS)
    } catch (error) {
      if (error instanceof ReaderTokenRejected) {
        // The token was rotated or revoked. Drop the edition, so the next view rebuilds, is refused, and
        // sends the reader to reconnect instead of reading a copy that can no longer be refreshed.
        await store.del(key)
        return
      }
      console.error('[tu-edicion] edition refresh failed; serving the stored copy', {
        message: String(error),
      })
    } finally {
      if (owner) await store.releaseLock(lock, owner).catch(() => undefined)
    }
  }

  return { builtAt: stored.builtAt, edition: stored.edition, refresh, state: 'stale' }
}

export const forgetEdition = (store: EditionStore, userId: number, environment?: string) =>
  store.del(editionKey(userId, environment))
