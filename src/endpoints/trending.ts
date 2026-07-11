import type { Endpoint, PayloadRequest } from 'payload'

import { trackArticleView } from '../lib/trending/redis'

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
  })

const readJSON = async <T>(req: PayloadRequest): Promise<T> => (await (req as Request).json()) as T

export const trendingEndpoints: Endpoint[] = [
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
