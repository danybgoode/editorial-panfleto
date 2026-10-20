import type { Endpoint, Where } from 'payload'

const json = (body: unknown, status = 200) => Response.json(body, { status })

const getRequestURL = (req: Parameters<Endpoint['handler']>[0]) =>
  new URL((req as unknown as Request).url)

const articleSelect = {
  articleType: true,
  author: true,
  coAuthors: true,
  featuredImage: true,
  headline: true,
  populatedAuthors: true,
  publishedAt: true,
  section: true,
  slug: true,
  summary: true,
} as const

/**
 * GET /api/articles/stream
 *
 * Cursor-based infinite scroll endpoint. Uses `publishedAt` as cursor so
 * that new articles inserted above never cause duplicates on scroll.
 *
 * Query params:
 *   before   – ISO timestamp cursor (exclusive). First page: omit.
 *   limit    – number of articles (1–24, default 12)
 *   section  – section slug to filter
 */
export const articlesEndpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/articles/stream',
    handler: async (req) => {
      try {
        const url = getRequestURL(req)
        const before = url.searchParams.get('before')
        const sectionSlug = url.searchParams.get('section')
        const rawLimit = Number(url.searchParams.get('limit') ?? '12')
        const limit = Math.max(1, Math.min(rawLimit, 24))

        const where: Where[] = []

        // Cursor: only articles published before the cursor timestamp
        if (before) {
          where.push({ publishedAt: { less_than: before } })
        }

        if (sectionSlug) {
          // Resolve section id from slug — sections collection is fine with where
          const sectionResult = await req.payload.find({
            collection: 'sections',
            depth: 0,
            limit: 1,
            overrideAccess: false,
            pagination: false,
            where: { slug: { equals: sectionSlug } },
          })
          const section = sectionResult.docs[0]
          if (!section) {
            return json({ articles: [], nextCursor: null })
          }
          where.push({ section: { equals: section.id } })
        }

        const result = await req.payload.find({
          collection: 'articles',
          depth: 2,
          limit: limit + 1,
          overrideAccess: false,
          pagination: false,
          select: articleSelect,
          sort: '-publishedAt',
          where: where.length > 0 ? { and: where } : undefined,
        })

        const docs = result.docs
        const hasMore = docs.length > limit
        const articles = hasMore ? docs.slice(0, limit) : docs
        const lastArticle = articles[articles.length - 1]
        const nextCursor =
          hasMore && lastArticle && lastArticle.publishedAt ? lastArticle.publishedAt : null

        return json({ articles, nextCursor })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load articles.'
        return json({ error: message }, 500)
      }
    },
  },
]
