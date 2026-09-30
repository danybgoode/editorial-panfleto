import { type MinifluxEntry, MinifluxRequestError, minifluxFetchAs } from '../miniflux/client'
import { extractCitedArticleUrl, isAggregatorUrl } from './aggregator'
import {
  enhanceReaderImages,
  extractLeadImage,
  fetchOpenGraphImage,
  fetchOriginalArticleHtml,
  injectLeadImage,
  normalizeLayoutAttributes,
  promoteLazyImages,
  stripReaderChrome,
} from './readerHtml'
import { isPlausibleToken } from './session'

export { extractLeadImage } from './readerHtml'

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
  // The best picture we could find for the story: the feed's own, else the publisher's og:image. Undefined when
  // every candidate was furniture (a share icon, a logo), so callers show a placeholder instead.
  leadImageUrl?: string
  permalinkUrl?: string
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

// What the reader will actually see once share buttons, paywall notices and lists of links are gone. A body
// that is 3,000 characters of "More on this story" links is thin, however long it is before cleaning.
const cleanedTextLength = (content: string, dropLinkFarms = false): number =>
  stripTags(stripReaderChrome(promoteLazyImages(content), { dropLinkFarms })).length

export const isThinAfterCleaning = (content?: string, dropLinkFarms = false): boolean => {
  if (!content) return true
  return cleanedTextLength(content, dropLinkFarms) < THIN_CONTENT_THRESHOLD
}

// Strip layout-only attributes that make scraped HTML wider than the viewport.
// Miniflux already sanitizes XSS; this is so width/nowrap/style cannot size the column.
export const normalizeReaderContent = (
  html: string,
  { dropLinkFarms = false, leadImageUrl }: { dropLinkFarms?: boolean; leadImageUrl?: string } = {},
): string => {
  const promoted = promoteLazyImages(html)
  const cleaned = stripReaderChrome(promoted, { dropLinkFarms })
  const laidOut = normalizeLayoutAttributes(cleaned)
  return injectLeadImage(laidOut, leadImageUrl)
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

  const feedSiteUrl = entry.feed?.site_url || entry.feed?.feed_url
  const aggregator = isAggregatorUrl(entry.url, feedSiteUrl)
  const citedUrl = aggregator ? extractCitedArticleUrl(entry.content) : undefined

  let content = entry.content || ''
  let readingTime = entry.reading_time || 0
  let usedOriginal = false

  if (citedUrl) {
    const original = await fetchOriginalArticleHtml(citedUrl, timeoutMs)
    if (original && stripTags(original).length > stripTags(content).length) {
      content = original
      usedOriginal = true
    }
  }

  const dropLinkFarms = aggregator && !usedOriginal
  let isThin = isThinAfterCleaning(content, dropLinkFarms)

  // If thin or explicitly requested, trigger Miniflux's autofetch + unwall fallback pipeline.
  // Aggregator homepages are skipped: fetch-content would scrape Techmeme, not the cited story.
  if ((isThin || options?.forceFetchOriginal) && !aggregator) {
    try {
      const scraped = await minifluxFetchAs<{ content?: string; reading_time?: number }>(
        token,
        `/entries/${entryId}/fetch-content?update_content=true`,
        { timeoutMs },
      )
      if (scraped?.content) {
        if (!isThinAfterCleaning(scraped.content)) {
          content = scraped.content
          if (scraped.reading_time) readingTime = scraped.reading_time
          isThin = false
        } else if (cleanedTextLength(scraped.content) > cleanedTextLength(content, dropLinkFarms)) {
          content = scraped.content
          if (scraped.reading_time) readingTime = scraped.reading_time
          isThin = isThinAfterCleaning(content)
        }
      }
    } catch (error) {
      // Miniflux failed to scrape original content (e.g. anti-bot/paywall).
      // Degrade gracefully to what we have in the entry rather than failing the whole page.
      console.warn(`[tu-edicion] fetch-content for entry ${entryId} fallback failed:`, error)
    }
  }

  isThin = isThinAfterCleaning(content, dropLinkFarms)
  const estimatedReadingTime =
    readingTime || Math.max(1, Math.round(cleanedTextLength(content, dropLinkFarms) / 1000))
  const sourceUrl = citedUrl || entry.url
  let leadImageUrl = extractLeadImage(content, entry.enclosures)

  // The feed gave us no picture worth using (none, or only share icons and logos). When there is also no body
  // to look at, ask the publisher which picture it uses for the story. Only in this branch: a full article
  // without a hero reads fine, and this costs a request to the source.
  if (!leadImageUrl && isThin) {
    leadImageUrl = await fetchOpenGraphImage(sourceUrl, Math.min(timeoutMs, 5000))
  }

  return {
    author: entry.author || undefined,
    categoryTitle: entry.feed?.category?.title || entry.category?.title || 'Sin categoría',
    commentsUrl: entry.comments_url || undefined,
    content: enhanceReaderImages(
      normalizeReaderContent(content, {
        dropLinkFarms,
        leadImageUrl,
      }),
    ),
    feedSiteUrl,
    feedTitle: entry.feed?.title || '',
    id: entry.id,
    isThin,
    leadImageUrl,
    permalinkUrl: citedUrl ? entry.url : undefined,
    publishedAt: entry.published_at || new Date().toISOString(),
    readingTime: estimatedReadingTime,
    title: entry.title,
    url: sourceUrl,
  }
}

