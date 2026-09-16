// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { identifyReader } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { openSession, sealSession, type ReaderSession } from '@/lib/personalized/session'

// Sprint 1 (fluxonline personalized-edition): the reader is recognised, their key stays server-side, and
// an anonymous request resolves to nobody.

const SECRET = 'a-test-secret-that-is-long-enough-0123456789'
const NOW = Date.UTC(2026, 8, 16, 12)
const reader: ReaderSession = {
  issuedAt: NOW,
  key: 'TOKENVALUEFORTHISTESTONLY0000000',
  userId: 2,
  username: 'lectora',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('the sealed session cookie', () => {
  it('round-trips, and the key is not readable in the cookie', () => {
    const sealed = sealSession(reader, SECRET)

    expect(sealed).not.toContain(reader.key)
    expect(sealed).not.toContain(reader.username)
    expect(openSession(sealed, SECRET, NOW)).toEqual(reader)
  })

  it('refuses a tampered cookie, a different secret, and an expired one', () => {
    const sealed = sealSession(reader, SECRET)
    const parts = sealed.split('.')
    const body = Buffer.from(parts[2], 'base64url')
    body[0] ^= 1
    parts[2] = body.toString('base64url')

    expect(openSession(parts.join('.'), SECRET, NOW)).toBeNull()
    expect(openSession(sealed, `${SECRET}-other`, NOW)).toBeNull()
    expect(openSession(sealed, SECRET, NOW + 31 * 24 * 3600 * 1000)).toBeNull()
    expect(openSession('v1.garbage', SECRET, NOW)).toBeNull()

    // A genuine tag cut short must not verify (GCM would otherwise accept it).
    const [v, iv, body2, tag] = sealed.split('.')
    const short = Buffer.from(tag, 'base64url').subarray(0, 4).toString('base64url')
    expect(openSession([v, iv, body2, short].join('.'), SECRET, NOW)).toBeNull()
  })

  it('gives two readers two different identities', () => {
    const other = {
      ...reader,
      key: 'ANOTHERTOKENFORTHISTESTONLY00000',
      userId: 3,
      username: 'otro',
    }

    expect(openSession(sealSession(reader, SECRET), SECRET, NOW)?.userId).toBe(2)
    expect(openSession(sealSession(other, SECRET), SECRET, NOW)?.userId).toBe(3)
  })
})

describe('the resolver', () => {
  it('resolves an anonymous request to no reader at all', () => {
    vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', 'true')
    vi.stubEnv('EDITORIAL_SESSION_SECRET', SECRET)

    expect(resolvePersonalizedReader(undefined, NOW)).toBeNull()
    expect(resolvePersonalizedReader(sealSession(reader, SECRET), NOW)?.userId).toBe(2)
  })

  it('refuses to work with a missing or short secret', () => {
    vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', 'true')
    vi.stubEnv('EDITORIAL_SESSION_SECRET', 'short')

    expect(resolvePersonalizedReader(sealSession(reader, 'short'), NOW)).toBeNull()
  })
})

describe('identifying a reader by their token', () => {
  it('refuses input that cannot be a token before any request is made', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await identifyReader('abc\r\nX-Forged: 1')).toEqual({ kind: 'malformed' })
    expect(await identifyReader('')).toEqual({ kind: 'malformed' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tells a rejected token apart from panfleto being down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Access Unauthorized', { status: 401 })),
    )
    expect(await identifyReader(reader.key)).toEqual({ kind: 'unauthorized' })

    // A proxy's 403 (a Cloudflare challenge) is not the token's fault.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('challenge', { status: 403 })),
    )
    expect(await identifyReader(reader.key)).toEqual({ kind: 'unavailable' })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad gateway', { status: 502 })),
    )
    expect(await identifyReader(reader.key)).toEqual({ kind: 'unavailable' })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    )
    expect(await identifyReader(reader.key)).toEqual({ kind: 'unavailable' })
  })

  it('returns the user the token belongs to, sending the token only as a header', async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ id: 3, username: 'otro' }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    expect(await identifyReader(reader.key)).toEqual({ kind: 'ok', userId: 3, username: 'otro' })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).not.toContain(reader.key)
    expect((init?.headers as Record<string, string>)['X-Auth-Token']).toBe(reader.key)
  })
})
