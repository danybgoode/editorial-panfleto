import type { Payload } from 'payload'

import type { Article } from '../../payload-types'
import { getArticleViewCount, getArticleViewCounts } from './redis'

export const getArticleAgeHours = ({
  now = new Date(),
  publishedAt,
}: {
  now?: Date
  publishedAt?: null | string
}) => {
  const publishedTime = publishedAt ? new Date(publishedAt).getTime() : now.getTime()

  if (Number.isNaN(publishedTime)) {
    return 0
  }

  return Math.max(0, (now.getTime() - publishedTime) / (1000 * 60 * 60))
}

export const getTrendingScore = ({
  multiplier = 1,
  publishedAt,
  views,
  now = new Date(),
}: {
  multiplier?: number | null
  now?: Date
  publishedAt?: null | string
  views: number
}) => {
  const ageHours = getArticleAgeHours({ now, publishedAt })

  return (views / Math.pow(ageHours + 2, 1.5)) * (multiplier || 1)
}

export const getArticleTrendingMetrics = async ({
  article,
  now = new Date(),
}: {
  article: Pick<Article, 'id' | 'publishedAt' | 'trendingMultiplier'>
  now?: Date
}) => {
  const rawViews24h = await getArticleViewCount({
    articleId: article.id,
    days: 1,
    now,
  })
  const viewsUsedForRank = await getArticleViewCount({
    articleId: article.id,
    days: 2,
    now,
  })
  const ageHours = getArticleAgeHours({
    now,
    publishedAt: article.publishedAt,
  })
  const multiplier = article.trendingMultiplier || 1
  const score = getTrendingScore({
    multiplier,
    now,
    publishedAt: article.publishedAt,
    views: viewsUsedForRank,
  })

  return {
    ageHours,
    multiplier,
    rawViews24h,
    score,
    viewsUsedForRank,
  }
}

export const getTrendingArticles = async ({
  candidateLimit = 100,
  days = 2,
  limit = 4,
  now = new Date(),
  payload,
}: {
  candidateLimit?: number
  days?: number
  limit?: number
  now?: Date
  payload: Payload
}) => {
  const counts = await getArticleViewCounts({ candidateLimit, days, now })
  const ids = Array.from(counts.keys())

  if (ids.length === 0) {
    return []
  }

  const articles = await payload.find({
    collection: 'articles',
    depth: 2,
    draft: false,
    limit: ids.length,
    overrideAccess: false,
    pagination: false,
    where: {
      id: {
        in: ids,
      },
    },
  })

  return (articles.docs as Article[])
    .map((article) => ({
      article,
      score: getTrendingScore({
        multiplier: article.trendingMultiplier,
        publishedAt: article.publishedAt,
        views: counts.get(String(article.id)) || 0,
        now,
      }),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ article }) => article)
}
