// Where a reader's derived edition lives between views (fluxonline personalized-edition D5).
//
// Upstash Redis over REST — already wired for trending, and unlike Next's data cache it survives a deploy
// and has a lock primitive. Everything stored here is derived and disposable: deleting it costs a rebuild.
// Without Upstash configured (local dev, specs) an in-process store stands in.

export type EditionStore = {
  acquireLock: (key: string, ttlSeconds: number) => Promise<boolean>
  del: (key: string) => Promise<void>
  get: (key: string) => Promise<null | string>
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>
}

const upstashStore = (restURL: string, token: string): EditionStore => {
  const command = async <T>(args: Array<number | string>): Promise<T> => {
    const response = await fetch(restURL, {
      body: JSON.stringify(args),
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) throw new Error(`Upstash ${args[0]} failed with ${response.status}`)
    const data = (await response.json()) as { error?: string; result?: T }
    if (data.error) throw new Error(`Upstash ${args[0]} failed: ${data.error}`)
    return data.result as T
  }

  return {
    acquireLock: async (key, ttlSeconds) =>
      (await command<null | string>(['SET', key, '1', 'NX', 'EX', ttlSeconds])) === 'OK',
    del: async (key) => {
      await command(['DEL', key])
    },
    get: (key) => command<null | string>(['GET', key]),
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
      if (read(key) !== null) return false
      values.set(key, { expiresAt: clock() + ttlSeconds * 1000, value: '1' })
      return true
    },
    del: async (key) => {
      values.delete(key)
    },
    get: async (key) => read(key),
    set: async (key, value, ttlSeconds) => {
      values.set(key, { expiresAt: clock() + ttlSeconds * 1000, value })
    },
  }
}

const globalForStore = globalThis as { __panfletoEditionStore?: EditionStore }

export const getEditionStore = (): EditionStore => {
  const restURL = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (restURL && token) return upstashStore(restURL.replace(/\/$/, ''), token)

  globalForStore.__panfletoEditionStore ??= createMemoryStore()
  return globalForStore.__panfletoEditionStore
}
