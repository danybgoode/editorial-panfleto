'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'

type Metrics = {
  ageHours: number
  multiplier: number
  rawViews24h: number
  redisConfigured: boolean
  score: number
  viewsUsedForRank: number
}

const formatViews = (views?: number) => `${Math.round(views || 0).toLocaleString()} views`

const formatAge = (hours?: number) => {
  if (typeof hours !== 'number') return 'Unavailable'
  if (hours < 1) return `${Math.round(hours * 60)} minutes`
  if (hours < 48) return `${hours.toFixed(1)} hours`

  return `${(hours / 24).toFixed(1)} days`
}

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      borderTop: '1px solid var(--theme-elevation-150)',
      display: 'grid',
      gap: '0.25rem',
      padding: '0.65rem 0',
    }}
  >
    <span style={{ color: 'var(--theme-elevation-600)', fontSize: '0.85rem' }}>{label}</span>
    <strong style={{ fontSize: '0.95rem', fontWeight: 600 }}>{value}</strong>
  </div>
)

export const TrendingMetricsPanel: React.FC = () => {
  const { id } = useDocumentInfo()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  const endpoint = useMemo(() => {
    if (!id) return null

    return `/api/trending/article-metrics?articleId=${encodeURIComponent(String(id))}`
  }, [id])

  useEffect(() => {
    if (!endpoint) {
      setMetrics(null)
      return
    }

    const controller = new AbortController()

    setError(null)
    setIsLoading(true)

    fetch(endpoint, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load trending metrics.')
        }

        setMetrics(result)
      })
      .catch((caughtError) => {
        if (controller.signal.aborted) return

        const message =
          caughtError instanceof Error ? caughtError.message : 'Unable to load trending metrics.'
        setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [endpoint])

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 8,
        marginBlock: '1rem',
        padding: '0.85rem 1rem',
      }}
    >
      <h3 style={{ fontSize: '1rem', margin: '0 0 0.35rem' }}>Trending score</h3>
      <p style={{ color: 'var(--theme-elevation-600)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
        Redis-backed ranking inputs for this article.
      </p>

      {!id && <MetricRow label="Status" value="Save this article before metrics are available." />}
      {isLoading && <MetricRow label="Status" value="Loading metrics..." />}
      {error && <MetricRow label="Status" value={error} />}

      {metrics && !isLoading && !error && (
        <>
          {!metrics.redisConfigured && (
            <MetricRow label="Status" value="Redis is not configured in this environment." />
          )}
          <MetricRow label="Raw page views (24h)" value={formatViews(metrics.rawViews24h)} />
          <MetricRow label="Views used for rank" value={formatViews(metrics.viewsUsedForRank)} />
          <MetricRow label="Article age" value={formatAge(metrics.ageHours)} />
          <MetricRow
            label="Admin multiplier override"
            value={`${metrics.multiplier.toFixed(1)}x`}
          />
          <MetricRow label="Final computed rank score" value={metrics.score.toFixed(1)} />
        </>
      )}
    </div>
  )
}

export default TrendingMetricsPanel
