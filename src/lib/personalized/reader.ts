import { type MinifluxEntry, MinifluxRequestError, minifluxFetchAs } from '../miniflux/client'
import { isPlausibleToken } from './session'

// Reading AS a reader, with their own key. Every outcome that matters to them is split out: "the token is
// wrong" tells them to replace it, so it must never be what an outage looks like (LEARNINGS 2026-09-16).

export type ReaderIdentity =
  | { kind: 'malformed' }
  | { kind: 'ok'; userId: number; username: string }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }

// Only a 401 means "this token". Miniflux answers a bad key with 401 and nothing else; a 403 on this path comes
// from the proxy in front of it (a Cloudflare challenge on Vercel's egress), and telling readers to replace a
// working token during that would sign every one of them out.
export const isUnauthorizedError = (error: unknown) =>
  error instanceof MinifluxRequestError && error.status === 401

const IDENTIFY_TIMEOUT_MS = 8000
const ENTRIES_TIMEOUT_MS = 20000

export const identifyReader = async (token: string): Promise<ReaderIdentity> => {
  if (!isPlausibleToken(token)) return { kind: 'malformed' }

  try {
    const me = await minifluxFetchAs<{ id?: unknown; username?: unknown }>(token, '/me', {
      timeoutMs: IDENTIFY_TIMEOUT_MS,
    })

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

export type ReaderEnclosure = {
  id?: number
  mime_type?: string
  size?: number
  url: string
}

// The fields of /v1/entries the edition reads. `content` is only measured and cut to an excerpt; it is never
// stored (the API has no field selection, so it still has to be downloaded).
export type ReaderEntry = {
  comments_url?: string
  content?: string
  enclosures?: ReaderEnclosure[]
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

export const extractLeadImage = (
  content?: string,
  enclosures?: Array<{ mime_type?: string; url?: string }>,
): string | undefined => {
  if (enclosures && enclosures.length > 0) {
    for (const enc of enclosures) {
      if (!enc.url) continue
      const mime = (enc.mime_type || '').toLowerCase()
      const url = enc.url.toLowerCase()
      if (
        mime.startsWith('image/') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.png') ||
        url.endsWith('.webp') ||
        url.endsWith('.avif') ||
        url.endsWith('.gif')
      ) {
        return enc.url
      }
    }
  }

  if (content) {
    const imgRegex = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi
    let match: RegExpExecArray | null
    while ((match = imgRegex.exec(content)) !== null) {
      const src = match[1].trim()
      if (!src.startsWith('http://') && !src.startsWith('https://')) continue

      const lower = src.toLowerCase()
      if (
        lower.includes('1x1') ||
        lower.includes('pixel') ||
        lower.includes('tracking') ||
        lower.includes('feedsportal') ||
        lower.includes('feedburner') ||
        lower.includes('gravatar.com') ||
        lower.includes('badge') ||
        lower.includes('share-button')
      ) {
        continue
      }

      const tagStr = match[0].toLowerCase()
      const widthMatch = tagStr.match(/width=["']?(\d+)["']?/)
      const heightMatch = tagStr.match(/height=["']?(\d+)["']?/)
      if (widthMatch && parseInt(widthMatch[1], 10) <= 2) continue
      if (heightMatch && parseInt(heightMatch[1], 10) <= 2) continue

      return src
    }
  }

  return undefined
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
    { timeoutMs: ENTRIES_TIMEOUT_MS },
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

export type ReaderArticle = {
  author?: string
  categoryTitle: string
  commentsUrl?: string
  content: string
  feedSiteUrl?: string
  feedTitle: string
  id: number
  isThin: boolean
  publishedAt: string
  readingTime: number
  title: string
  url: string
}

export const ARTICLE_TIMEOUT_MS = 15000
export const THIN_CONTENT_THRESHOLD = 1000

export const stripTags = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

export const isThinContent = (content?: string): boolean => {
  if (!content) return true
  return stripTags(content).length < THIN_CONTENT_THRESHOLD
}

export const fetchReaderArticle = async (
  token: string,
  entryId: number,
  options?: {
    forceFetchOriginal?: boolean
    timeoutMs?: number
  },
): Promise<ReaderArticle> => {
  const timeoutMs = options?.timeoutMs ?? ARTICLE_TIMEOUT_MS

  const entry = await minifluxFetchAs<MinifluxEntry>(token, `/entries/${entryId}`, {
    timeoutMs,
  })

  let content = entry.content || ''
  let readingTime = entry.reading_time || 0
  let isThin = isThinContent(content)

  // If thin or explicitly requested, trigger Miniflux's autofetch + unwall fallback pipeline
  if (isThin || options?.forceFetchOriginal) {
    try {
      const scraped = await minifluxFetchAs<{ content?: string; reading_time?: number }>(
        token,
        `/entries/${entryId}/fetch-content?update_content=true`,
        { timeoutMs },
      )
      if (scraped?.content) {
        if (!isThinContent(scraped.content)) {
          content = scraped.content
          if (scraped.reading_time) readingTime = scraped.reading_time
          isThin = false
        } else if (scraped.content.length > content.length) {
          content = scraped.content
          if (scraped.reading_time) readingTime = scraped.reading_time
          isThin = isThinContent(content)
        }
      }
    } catch (error) {
      // Miniflux failed to scrape original content (e.g. anti-bot/paywall).
      // Degrade gracefully to what we have in the entry rather than failing the whole page.
      console.warn(`[tu-edicion] fetch-content for entry ${entryId} fallback failed:`, error)
    }
  }

  const estimatedReadingTime =
    readingTime || Math.max(1, Math.round(stripTags(content).length / 1000))

  return {
    author: entry.author || undefined,
    categoryTitle: entry.feed?.category?.title || entry.category?.title || 'Sin categoría',
    commentsUrl: entry.comments_url || undefined,
    content,
    feedSiteUrl: entry.feed?.site_url || entry.feed?.feed_url || undefined,
    feedTitle: entry.feed?.title || '',
    id: entry.id,
    isThin,
    publishedAt: entry.published_at || new Date().toISOString(),
    readingTime: estimatedReadingTime,
    title: entry.title,
    url: entry.url,
  }
}

