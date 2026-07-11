import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminOrEditor } from '../access/roles'
import { importMinifluxEntry, syncMinifluxMapping } from '../lib/miniflux/importer'

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
  })

const readJSON = async <T>(req: PayloadRequest): Promise<T> => (await (req as Request).json()) as T

const assertCanImport = (req: PayloadRequest) => {
  if (!isAdminOrEditor(req.user)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  return null
}

export const minifluxEndpoints: Endpoint[] = [
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
