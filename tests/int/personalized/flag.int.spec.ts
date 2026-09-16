// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadPersonalizedEdition } from '@/lib/personalized/load'
import { sealSession, SESSION_COOKIE } from '@/lib/personalized/session'
import { createMemoryStore } from '@/lib/personalized/store'
import { GET as signOutGET } from '@/app/(frontend)/tu-edicion/salir/route'
import { proxy } from '@/proxy'

// Sprint 3.3 (fluxonline personalized-edition): `editorial.personalized_enabled`, enablement polarity. Off,
// a signed-in reader is anonymous, and nothing is fetched or cached for them.

const SECRET = 'a-test-secret-that-is-long-enough-0123456789'
const cookie = sealSession(
  { issuedAt: Date.now(), key: 'TOKENVALUEFORTHISTESTONLY0000000', userId: 2, username: 'lectora' },
  SECRET,
)

const spies = () => {
  const store = createMemoryStore()
  const storeSpies = {
    acquireLock: vi.spyOn(store, 'acquireLock'),
    del: vi.spyOn(store, 'del'),
    get: vi.spyOn(store, 'get'),
    set: vi.spyOn(store, 'set'),
  }
  const source = {
    fetchEntriesPage: vi.fn(async () => []),
    fetchHackerNewsComments: vi.fn(async () => 0),
    identify: vi.fn(async () => ({ kind: 'ok' as const, userId: 2, username: 'lectora' })),
  }
  return { source, store, storeSpies }
}

const frontPageRequest = () =>
  new NextRequest('https://editorial-panfleto.vercel.app/', {
    headers: { cookie: `${SESSION_COOKIE}=${cookie}` },
  })

afterEach(() => vi.unstubAllEnvs())

describe('with the flag off', () => {
  it('treats a signed-in reader as anonymous, with no fetch and no cache read or write', async () => {
    vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', 'false')
    vi.stubEnv('EDITORIAL_SESSION_SECRET', SECRET)
    const { source, store, storeSpies } = spies()

    expect(await loadPersonalizedEdition(cookie, { source, store })).toBeNull()
    expect(source.fetchEntriesPage).not.toHaveBeenCalled()
    for (const spy of Object.values(storeSpies)) expect(spy).not.toHaveBeenCalled()
  })

  it('leaves the front page alone for that reader', () => {
    vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', 'false')
    vi.stubEnv('EDITORIAL_SESSION_SECRET', SECRET)

    expect(proxy(frontPageRequest()).headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('stays off for anything that is not exactly "true"', async () => {
    vi.stubEnv('EDITORIAL_SESSION_SECRET', SECRET)
    for (const value of ['', 'TRUE', '1', 'yes']) {
      vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', value)
      expect(await loadPersonalizedEdition(cookie, spies())).toBeNull()
    }
  })
})

describe('with the flag on', () => {
  it("rewrites a connected reader's front page to their edition, and builds it", async () => {
    vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', 'true')
    vi.stubEnv('EDITORIAL_SESSION_SECRET', SECRET)
    const { source, store } = spies()

    expect(proxy(frontPageRequest()).headers.get('x-middleware-rewrite')).toBe(
      'https://editorial-panfleto.vercel.app/tu-edicion',
    )
    const loaded = await loadPersonalizedEdition(cookie, { source, store })
    expect(loaded?.reader.userId).toBe(2)
    expect(source.fetchEntriesPage).toHaveBeenCalledTimes(1)
  })

  it('leaves an invalid cookie on the curated front page', () => {
    vi.stubEnv('EDITORIAL_PERSONALIZED_ENABLED', 'true')
    vi.stubEnv('EDITORIAL_SESSION_SECRET', SECRET)
    const request = new NextRequest('https://editorial-panfleto.vercel.app/', {
      headers: { cookie: `${SESSION_COOKIE}=v1.forged.cookie.value` },
    })

    expect(proxy(request).headers.get('x-middleware-rewrite')).toBeNull()
  })
})

describe('the expired-token sign-out route', () => {
  it('signs out on our own redirect, and ignores a cross-site request', () => {
    const own = signOutGET(
      new NextRequest('https://editorial-panfleto.vercel.app/tu-edicion/salir', {
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
    )
    expect(own.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`)

    const foreign = signOutGET(
      new NextRequest('https://editorial-panfleto.vercel.app/tu-edicion/salir', {
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    )
    expect(foreign.headers.get('set-cookie')).toBeNull()
  })
})
