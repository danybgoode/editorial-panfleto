export type MinifluxEntry = {
  id: number
  title: string
  url: string
  comments_url?: string
  author?: string
  content?: string
  feed?: {
    id: number
    title: string
  }
  category?: {
    id: number
    title: string
  }
  published_at?: string
  created_at?: string
}

export type MinifluxCategory = {
  id: number
  title: string
}

export type MinifluxFeed = {
  id: number
  title: string
  site_url?: string
  feed_url?: string
  category?: MinifluxCategory
}

type MinifluxEntriesResponse = {
  entries?: MinifluxEntry[]
}

type FetchEntriesArgs = {
  limit: number
  sourceType: 'category' | 'feed'
  targetId: string
}

const DEFAULT_MINIFLUX_URL = 'https://app.panfleto.win'

export class MinifluxRequestError extends Error {
  status: number

  constructor(status: number, details: string) {
    super(`Miniflux request failed (${status}): ${details}`)
    this.name = 'MinifluxRequestError'
    this.status = status
  }
}

const getMinifluxBaseURL = () =>
  `${(process.env.MINIFLUX_URL || DEFAULT_MINIFLUX_URL).replace(/\/$/, '')}/v1`

const getMinifluxToken = () => {
  const token = process.env.MINIFLUX_API_KEY || process.env.MINIFLUX_API_TOKEN

  if (!token) {
    throw new Error('MINIFLUX_API_KEY is not configured.')
  }

  return token
}

const minifluxFetch = async <T>(path: string): Promise<T> =>
  minifluxFetchAs<T>(getMinifluxToken(), path)

// The per-call form: the anonymous importer passes the newsroom's env key through minifluxFetch above,
// and the personalized edition passes a reader's own key. The token is never part of an error message.
export const minifluxFetchAs = async <T>(
  token: string,
  path: string,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<T> => {
  const response = await fetch(`${getMinifluxBaseURL()}${path}`, {
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new MinifluxRequestError(response.status, details || response.statusText)
  }

  return response.json() as Promise<T>
}

export const fetchMinifluxCategories = async (): Promise<MinifluxCategory[]> =>
  minifluxFetch<MinifluxCategory[]>('/categories')

export const fetchMinifluxFeedsForCategory = async (
  categoryId: number | string,
): Promise<MinifluxFeed[]> =>
  minifluxFetch<MinifluxFeed[]>(`/categories/${encodeURIComponent(categoryId)}/feeds`)

export const fetchMinifluxEntries = async ({
  limit,
  sourceType,
  targetId,
}: FetchEntriesArgs): Promise<MinifluxEntry[]> => {
  const safeLimit = Math.max(1, Math.min(limit, 15))
  const params = new URLSearchParams({
    direction: 'desc',
    limit: String(safeLimit),
    order: 'published_at',
    status: 'unread',
  })

  if (sourceType === 'category') {
    params.set('category_id', targetId)
  } else {
    params.set('feed_id', targetId)
  }

  const data = await minifluxFetch<MinifluxEntriesResponse>(`/entries?${params.toString()}`)

  return data.entries || []
}

const getEntryIdFromInput = (input: string): string | null => {
  const trimmed = input.trim()
  const directId = trimmed.match(/^\d+$/)
  if (directId) return trimmed

  const urlMatch = trimmed.match(/\/entries\/(\d+)/)
  if (urlMatch?.[1]) return urlMatch[1]

  return null
}

export const fetchMinifluxEntry = async (input: string): Promise<MinifluxEntry> => {
  const entryId = getEntryIdFromInput(input)

  if (!entryId) {
    const params = new URLSearchParams({
      limit: '1',
      order: 'published_at',
      search: input.trim(),
      status: 'all',
    })
    const data = await minifluxFetch<MinifluxEntriesResponse>(`/entries?${params.toString()}`)
    const [entry] = data.entries || []

    if (!entry) {
      throw new Error('No Miniflux entry matched that URL or search value.')
    }

    return entry
  }

  return minifluxFetch<MinifluxEntry>(`/entries/${entryId}`)
}
