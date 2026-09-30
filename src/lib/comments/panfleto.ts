import {
  countThreadComments,
  sanitizeCommentHTML,
  type HNComment,
  type HNThread,
} from './hackernews'

type PanfletoComment = {
  author?: string | null
  children?: PanfletoComment[]
  created_at?: string
  id?: number | string
  text?: string | null
}

const toNumericId = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const asInt = Number.parseInt(value, 10)
    if (Number.isFinite(asInt)) return asInt
    let hash = 0
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
    return Math.abs(hash) || 1
  }
  return 0
}

const mapComment = (node: PanfletoComment): HNComment => ({
  author: node.author || null,
  children: Array.isArray(node.children) ? node.children.map(mapComment) : [],
  created_at: node.created_at || '',
  id: toNumericId(node.id),
  text: node.text ? sanitizeCommentHTML(node.text) : null,
})

export async function fetchPanfletoCommentThread(url: string): Promise<HNThread | null> {
  try {
    const response = await fetch(
      `https://app.panfleto.win/v1/comments?url=${encodeURIComponent(url)}`,
      {
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok) return null

    const data = (await response.json()) as { comments?: PanfletoComment[] } | null
    if (!data?.comments || !Array.isArray(data.comments) || data.comments.length === 0) {
      return null
    }

    const children = data.comments.map(mapComment)
    return {
      children,
      id: toNumericId(url),
      totalComments: countThreadComments(children),
    }
  } catch (error) {
    console.warn('[comments] could not fetch via panfleto API:', error)
    return null
  }
}
