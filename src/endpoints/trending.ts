import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminOrEditor } from '../access/roles'
import { getArticleTrendingMetrics } from '../lib/trending/ranking'
import { isTrendingRedisConfigured, trackArticleView } from '../lib/trending/redis'

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
  })

const readJSON = async <T>(req: PayloadRequest): Promise<T> => (await (req as Request).json()) as T

const getRequestURL = (req: PayloadRequest) => new URL((req as Request).url)

const assertCanReadMetrics = (req: PayloadRequest) => {
  if (!isAdminOrEditor(req.user)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  return null
}

export const trendingEndpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/trending/article-metrics',
    handler: async (req) => {
      const unauthorized = assertCanReadMetrics(req)
      if (unauthorized) return unauthorized

      try {
        const articleId = getRequestURL(req).searchParams.get('articleId')

        if (!articleId) {
          return json({ error: 'articleId is required.' }, 400)
        }

        const article = await req.payload.findByID({
          id: articleId,
          collection: 'articles',
          depth: 0,
          draft: true,
          overrideAccess: true,
          req,
        })
        const metrics = await getArticleTrendingMetrics({ article })

        return json({
          ...metrics,
          redisConfigured: isTrendingRedisConfigured(),
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to fetch article metrics.'
        return json({ error: message }, 500)
      }
    },
  },
  {
    method: 'post',
    path: '/trending/view',
    handler: async (req) => {
      try {
        const body = await readJSON<{ articleId?: number | string }>(req)

        if (!body.articleId) {
          return json({ error: 'articleId is required.' }, 400)
        }

        const result = await trackArticleView(body.articleId)

        return json(
          {
            tracked: !result.skipped,
          },
          202,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to track article view.'
        return json({ error: message }, 500)
      }
    },
  },
]
