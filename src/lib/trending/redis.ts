type RedisCommandArg = number | string

type RedisResult<T> = {
  error?: string
  result?: T
}

const VIEW_KEY_PREFIX = 'news:views'
const VIEW_KEY_TTL_SECONDS = 60 * 60 * 24 * 3

const getRedisConfig = () => {
  const restURL = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!restURL || !token) {
    return null
  }

  return {
    restURL: restURL.replace(/\/$/, ''),
    token,
  }
}

export const getViewsKeyForDate = (date = new Date()) =>
  `${VIEW_KEY_PREFIX}:${date.toISOString().slice(0, 10)}`

export const getRecentViewsKeys = (days: number, now = new Date()) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - index)
    return getViewsKeyForDate(date)
  })

const redisPipeline = async <T>(commands: RedisCommandArg[][]): Promise<Array<RedisResult<T>>> => {
  const config = getRedisConfig()

  if (!config) {
    return []
  }

  const response = await fetch(`${config.restURL}/pipeline`, {
    body: JSON.stringify(commands),
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Upstash Redis request failed: ${response.status} ${errorBody}`)
  }

  return (await response.json()) as Array<RedisResult<T>>
}

export const trackArticleView = async (articleId: number | string) => {
  const key = getViewsKeyForDate()
  const results = await redisPipeline([
    ['ZINCRBY', key, 1, String(articleId)],
    ['EXPIRE', key, VIEW_KEY_TTL_SECONDS],
  ])

  return {
    skipped: results.length === 0,
  }
}

export const getArticleViewCounts = async ({
  candidateLimit = 100,
  days = 2,
  now = new Date(),
}: {
  candidateLimit?: number
  days?: number
  now?: Date
} = {}) => {
  const keys = getRecentViewsKeys(days, now)
  const results = await redisPipeline<Array<string | number>>(
    keys.map((key) => ['ZREVRANGE', key, 0, candidateLimit - 1, 'WITHSCORES']),
  )
  const counts = new Map<string, number>()

  for (const response of results) {
    if (!response.result || response.error) continue

    for (let index = 0; index < response.result.length; index += 2) {
      const articleId = String(response.result[index])
      const views = Number(response.result[index + 1] || 0)

      counts.set(articleId, (counts.get(articleId) || 0) + views)
    }
  }

  return counts
}
