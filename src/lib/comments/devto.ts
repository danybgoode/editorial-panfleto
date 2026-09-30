import {
  countThreadComments,
  sanitizeCommentHTML,
  type HNComment,
  type HNThread,
} from './hackernews'

const RESERVED = new Set([
  'about',
  'contact',
  'enter',
  'faq',
  'listings',
  'new',
  'notifications',
  'pod',
  'privacy',
  'search',
  'settings',
  't',
  'tags',
  'videos',
])

export const parseDevToArticlePath = (
  url?: string,
): { slug: string; username: string } | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!/(^|\.)dev\.to$/i.test(parsed.hostname)) return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    if (RESERVED.has(parts[0].toLowerCase())) return null
    return { slug: parts[1], username: parts[0] }
  } catch {
    return null
  }
}

type DevToComment = {
  body_html?: string
  children?: DevToComment[]
  created_at?: string
  id_code?: string
  user?: { name?: string; username?: string }
}

const toId = (code?: string): number => {
  if (!code) return 0
  const asInt = Number.parseInt(code, 36)
  if (Number.isFinite(asInt)) return asInt
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) | 0
  return Math.abs(hash) || 1
}

const mapComment = (node: DevToComment): HNComment => ({
  author: node.user?.username || node.user?.name || null,
  children: Array.isArray(node.children) ? node.children.map(mapComment) : [],
  created_at: node.created_at || '',
  id: toId(node.id_code),
  text: node.body_html ? sanitizeCommentHTML(node.body_html) : null,
})

export async function fetchDevToThread(articleUrl: string): Promise<HNThread | null> {
  const path = parseDevToArticlePath(articleUrl)
  if (!path) return null

  try {
    const articleRes = await fetch(
      `https://dev.to/api/articles/${encodeURIComponent(path.username)}/${encodeURIComponent(path.slug)}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) },
    )
    if (!articleRes.ok) return null
    const article = (await articleRes.json()) as { id?: number; url?: string }
    if (typeof article.id !== 'number') return null

    const commentsRes = await fetch(`https://dev.to/api/comments?a_id=${article.id}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
    if (!commentsRes.ok) return null
    const raw = (await commentsRes.json()) as DevToComment[]
    if (!Array.isArray(raw) || raw.length === 0) return null

    const children = raw.map(mapComment)
    return {
      children,
      id: article.id,
      totalComments: countThreadComments(children),
    }
  } catch (error) {
    console.warn('[comments] could not fetch DEV.to thread:', error)
    return null
  }
}
