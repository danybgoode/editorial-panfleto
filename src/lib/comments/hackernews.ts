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
  created_at: string
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

export async function fetchHackerNewsThread(itemId: string): Promise<HNThread | null> {
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
