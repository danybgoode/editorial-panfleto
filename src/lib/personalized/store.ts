// Where a reader's derived edition lives between views (fluxonline personalized-edition D5).
//
// Upstash Redis over REST — already wired for trending, and unlike Next's data cache it survives a deploy
// and has a lock primitive. Everything stored here is derived and disposable: deleting it costs a rebuild.
// Without Upstash configured (local dev, specs) an in-process store stands in.

export type EditionStore = {
  // Resolves to an owner token when the lock was taken, null when someone else holds it.
  acquireLock: (key: string, ttlSeconds: number) => Promise<null | string>
  del: (key: string) => Promise<void>
  get: (key: string) => Promise<null | string>
  // Releases the lock only if `owner` still holds it, so a slow refresh can't drop a newer one's lock.
  releaseLock: (key: string, owner: string) => Promise<void>
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>
}

const UPSTASH_TIMEOUT_MS = 1500

const newOwner = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const upstashStore = (restURL: string, token: string): EditionStore => {
  const command = async <T>(args: Array<number | string>): Promise<T> => {
    const response = await fetch(restURL, {
      body: JSON.stringify(args),
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Upstash ${args[0]} failed with ${response.status}`)
    const data = (await response.json()) as { error?: string; result?: T }
    if (data.error) throw new Error(`Upstash ${args[0]} failed: ${data.error}`)
    return data.result as T
  }

  return {
    acquireLock: async (key, ttlSeconds) => {
      const owner = newOwner()
      const result = await command<null | string>(['SET', key, owner, 'NX', 'EX', ttlSeconds])
      return result === 'OK' ? owner : null
    },
    del: async (key) => {
      await command(['DEL', key])
    },
    get: (key) => command<null | string>(['GET', key]),
    releaseLock: async (key, owner) => {
      if ((await command<null | string>(['GET', key])) === owner) await command(['DEL', key])
    },
    set: async (key, value, ttlSeconds) => {
      await command(['SET', key, value, 'EX', ttlSeconds])
    },
  }
}

export const createMemoryStore = (clock: () => number = Date.now): EditionStore => {
  const values = new Map<string, { expiresAt: number; value: string }>()
  const read = (key: string) => {
    const item = values.get(key)
    if (!item) return null
    if (item.expiresAt <= clock()) {
      values.delete(key)
      return null
    }
    return item.value
  }

  return {
    acquireLock: async (key, ttlSeconds) => {
      if (read(key) !== null) return null
      const owner = newOwner()
      values.set(key, { expiresAt: clock() + ttlSeconds * 1000, value: owner })
      return owner
    },
    del: async (key) => {
      values.delete(key)
    },
    get: async (key) => read(key),
    releaseLock: async (key, owner) => {
      if (read(key) === owner) values.delete(key)
    },
    set: async (key, value, ttlSeconds) => {
      if (values.size > 1000) for (const stale of [...values.keys()]) read(stale)
      values.set(key, { expiresAt: clock() + ttlSeconds * 1000, value })
    },
  }
}

const globalForStore = globalThis as { __panfletoEditionStore?: EditionStore }

export const getEditionStore = (): EditionStore => {
  const restURL = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (restURL && token) return upstashStore(restURL.replace(/\/$/, ''), token)

  if (!globalForStore.__panfletoEditionStore && process.env.VERCEL_ENV === 'production') {
    console.error(
      '[tu-edicion] Upstash is not configured in production; editions live per instance only',
    )
  }
  globalForStore.__panfletoEditionStore ??= createMemoryStore()
  return globalForStore.__panfletoEditionStore
}
