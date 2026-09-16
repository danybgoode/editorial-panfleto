import { MinifluxRequestError, minifluxFetchAs } from '../miniflux/client'
import { isPlausibleToken } from './session'

// Reading AS a reader, with their own key. Every outcome that matters to them is split out: "the token is
// wrong" tells them to replace it, so it must never be what an outage looks like (LEARNINGS 2026-09-16).

export type ReaderIdentity =
  | { kind: 'malformed' }
  | { kind: 'ok'; userId: number; username: string }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }

export const isUnauthorizedError = (error: unknown) =>
  error instanceof MinifluxRequestError && (error.status === 401 || error.status === 403)

export const identifyReader = async (token: string): Promise<ReaderIdentity> => {
  if (!isPlausibleToken(token)) return { kind: 'malformed' }

  try {
    const me = await minifluxFetchAs<{ id?: unknown; username?: unknown }>(token, '/me')

    if (typeof me.id !== 'number' || typeof me.username !== 'string') return { kind: 'unavailable' }

    return { kind: 'ok', userId: me.id, username: me.username }
  } catch (error) {
    if (isUnauthorizedError(error)) return { kind: 'unauthorized' }

    console.error('[tu-edicion] panfleto /v1/me unavailable', {
      status: error instanceof MinifluxRequestError ? error.status : 'transport',
    })

    return { kind: 'unavailable' }
  }
}
