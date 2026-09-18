export type HNComment = {
  id: number
  author: string | null
  created_at: string
  text: string | null
  children: HNComment[]
}

export type HNThread = {
  id: number
  title?: string
  author?: string
  points?: number
  created_at?: string
  children: HNComment[]
  totalComments: number
}

export function getHackerNewsItemId(commentsUrl?: string, url?: string): string | null {
  for (const target of [commentsUrl, url]) {
    if (!target) continue
    const match = target.match(/news\.ycombinator\.com\/item\?id=(\d+)/i)
    if (match) return match[1]
  }
  return null
}

export function sanitizeCommentHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
      const cleanAttrs = attrs
        .replace(/\s+target=["'][^"']*["']/gi, '')
        .replace(/\s+rel=["'][^"']*["']/gi, '')
        .trim()
      return `<a ${cleanAttrs} target="_blank" rel="noopener noreferrer">`
    })
}

export function countDescendantComments(comment: HNComment): number {
  let count = 0
  if (comment.text || comment.author) count++
  for (const child of comment.children || []) {
    count += countDescendantComments(child)
  }
  return count
}

export function countThreadComments(children: HNComment[]): number {
  return children.reduce((total, child) => total + countDescendantComments(child), 0)
}

// fetchHackerNewsThreadFromPanfleto fetches comments from panfleto-reader API
// This is the preferred method as it uses the shared sanitization backend
export async function fetchHackerNewsThreadFromPanfleto(commentsUrl: string): Promise<HNThread | null> {
  try {
    // Convert HN item ID to URL format if needed
    const url = commentsUrl.includes('news.ycombinator.com/item?id=') 
      ? commentsUrl 
      : `https://news.ycombinator.com/item?id=${commentsUrl}`
    
    const response = await fetch(`https://app.panfleto.win/v1/comments?url=${encodeURIComponent(url)}`, {
      next: { revalidate: 600 }, // Match panfleto cache TTL
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) {
      // If panfleto API fails, fall back to direct Algolia
      return null
    }
    
    const data = await response.json()
    
    if (!data || !data.comments) {
      return null
    }

    // Map panfleto's JSON format to our HNThread format
    const mapComment = (c: any): HNComment => ({
      id: c.id || 0,
      author: c.author || null,
      created_at: c.created_at || '',
      text: c.text || null,
      children: Array.isArray(c.children) ? c.children.map(mapComment) : [],
    })

    const children = data.comments.map(mapComment)
    const totalComments = countThreadComments(children)

    return {
      id: extractHNIdFromUrl(commentsUrl) || 0,
      children,
      totalComments,
      // These fields are not available from panfleto API, will be undefined
      // When needed, they should be fetched from Algolia
    }
  } catch (e) {
    console.warn(`[comments] could not fetch via panfleto API:`, e)
    return null
  }
}

// extractHNIdFromUrl extracts the Hacker News item ID from a URL
function extractHNIdFromUrl(url: string): number | null {
  const match = url.match(/news\.ycombinator\.com\/item\?id=(\d+)/i)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

// fetchHackerNewsThread fetches comments from HN Algolia API (fallback)
export async function fetchHackerNewsThread(itemId: string): Promise<HNThread | null> {
  // Try panfleto API first
  const panfletoThread = await fetchHackerNewsThreadFromPanfleto(itemId)
  if (panfletoThread) {
    return panfletoThread
  }

  // Fallback to direct Algolia API
  try {
    const response = await fetch(`https://hn.algolia.com/api/v1/items/${itemId}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!data || typeof data.id !== 'number') return null

    const sanitizeTree = (node: HNComment): HNComment => ({
      id: node.id,
      author: node.author,
      created_at: node.created_at,
      text: node.text ? sanitizeCommentHTML(node.text) : null,
      children: Array.isArray(node.children) ? node.children.map(sanitizeTree) : [],
    })

    const rawChildren: HNComment[] = Array.isArray(data.children) ? data.children : []
    const children = rawChildren.map(sanitizeTree)
    const totalComments = countThreadComments(children)

    return {
      id: data.id,
      title: data.title,
      author: data.author,
      points: data.points,
      created_at: data.created_at,
      children,
      totalComments,
    }
  } catch (e) {
    console.warn(`[comments] could not fetch HN thread ${itemId}:`, e)
    return null
  }
}
