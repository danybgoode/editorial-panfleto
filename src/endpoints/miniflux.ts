import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminOrEditor } from '../access/roles'
import { publishJSONToQStash } from '../lib/qstash/publish'
import { importMinifluxEntry, syncMinifluxMapping } from '../lib/miniflux/importer'
import { fetchMinifluxCategories, fetchMinifluxFeedsForCategory } from '../lib/miniflux/client'
import { getServerSideURL } from '../utilities/getURL'

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
  })

const readJSON = async <T>(req: PayloadRequest): Promise<T> => (await (req as Request).json()) as T

const getRequestURL = (req: PayloadRequest) => new URL((req as Request).url)

const assertCanImport = (req: PayloadRequest) => {
  if (!isAdminOrEditor(req.user)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  return null
}

const assertCronSecret = (req: PayloadRequest) => {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return json({ error: 'CRON_SECRET is not configured.' }, 500)
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  return null
}

export const minifluxEndpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/miniflux/categories',
    handler: async (req) => {
      const unauthorized = assertCanImport(req)
      if (unauthorized) return unauthorized

      try {
        const categories = await fetchMinifluxCategories()
        return json({ categories })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to fetch Miniflux categories.'
        return json({ error: message }, 500)
      }
    },
  },
  {
    method: 'get',
    path: '/miniflux/feeds',
    handler: async (req) => {
      const unauthorized = assertCanImport(req)
      if (unauthorized) return unauthorized

      try {
        const categoryId = getRequestURL(req).searchParams.get('categoryId')

        if (!categoryId) {
          return json({ error: 'categoryId is required.' }, 400)
        }

        const feeds = await fetchMinifluxFeedsForCategory(categoryId)
        return json({ feeds })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to fetch Miniflux feeds.'
        return json({ error: message }, 500)
      }
    },
  },
  {
    method: 'post',
    path: '/miniflux/cron-trigger',
    handler: async (req) => {
      const unauthorized = assertCronSecret(req)
      if (unauthorized) return unauthorized

      try {
        const mappings = await req.payload.find({
          collection: 'miniflux-mappings',
          depth: 0,
          limit: 100,
          overrideAccess: true,
          pagination: false,
          where: {
            enabled: {
              equals: true,
            },
          },
        })
        const cronSecret = process.env.CRON_SECRET as string
        const workerURL = `${getServerSideURL()}/api/miniflux/sync-feed`
        const published = await Promise.all(
          mappings.docs.map((mapping) =>
            publishJSONToQStash({
              body: {
                mappingId: mapping.id,
              },
              cronSecret,
              destination: workerURL,
            }),
          ),
        )

        return json(
          {
            enqueued: published.length,
            messages: published,
          },
          202,
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to enqueue Miniflux sync jobs.'
        return json({ error: message }, 500)
      }
    },
  },
  {
    method: 'post',
    path: '/miniflux/sync-feed',
    handler: async (req) => {
      const unauthorized = assertCronSecret(req)
      if (unauthorized) return unauthorized

      try {
        const body = await readJSON<{ mappingId?: number | string }>(req)

        if (!body.mappingId) {
          return json({ error: 'mappingId is required.' }, 400)
        }

        const result = await syncMinifluxMapping({
          mappingId: body.mappingId,
          overrideAccess: true,
          payload: req.payload,
          req,
        })

        return json(result)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to sync Miniflux mapping.'
        return json({ error: message }, 500)
      }
    },
  },
  {
    method: 'post',
    path: '/miniflux/sync-mapping',
    handler: async (req) => {
      const unauthorized = assertCanImport(req)
      if (unauthorized) return unauthorized

      try {
        const body = await readJSON<{ mappingId?: number | string }>(req)

        if (!body.mappingId) {
          return json({ error: 'mappingId is required.' }, 400)
        }

        const result = await syncMinifluxMapping({
          mappingId: body.mappingId,
          payload: req.payload,
          req,
        })

        return json(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to sync Miniflux mapping.'
        return json({ error: message }, 500)
      }
    },
  },
  {
    method: 'post',
    path: '/miniflux/import-entry',
    handler: async (req) => {
      const unauthorized = assertCanImport(req)
      if (unauthorized) return unauthorized

      try {
        const body = await readJSON<{
          authorId?: number | string
          input?: string
          sectionId?: number | string
        }>(req)

        if (!body.input || !body.sectionId || !body.authorId) {
          return json({ error: 'input, sectionId, and authorId are required.' }, 400)
        }

        const result = await importMinifluxEntry({
          author: body.authorId,
          input: body.input,
          payload: req.payload,
          req,
          section: body.sectionId,
        })

        return json(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to import Miniflux entry.'
        return json({ error: message }, 500)
      }
    },
  },
]
