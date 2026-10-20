'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Media } from '@/components/Media'
import type { Article } from '@/payload-types'
import {
  formatEditorialDate,
  getArticleAuthors,
  getArticleHref,
  getSectionName,
  getSectionHref,
  articleTypes,
} from '@/utilities/editorial'

type Props = {
  /** Articles rendered server-side for the first page */
  initialArticles: Article[]
  /** ISO timestamp of the oldest initial article — used as the first cursor */
  initialCursor: string | null
  /** Filter: section slug */
  sectionSlug?: string
  /** Max per page */
  limit?: number
}

type MonthBand = { kind: 'month'; label: string; key: string }
type ArticleItem = { kind: 'article'; article: Article }
type ListItem = MonthBand | ArticleItem

const getMonthLabel = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))

const getMonthKey = (iso: string) => iso.slice(0, 7) // "2026-10"

function buildItems(articles: Article[], prevArticles: Article[]): ListItem[] {
  const all = [...prevArticles, ...articles]
  const result: ListItem[] = []
  let lastMonthKey = prevArticles.length > 0 ? getMonthKey(prevArticles[prevArticles.length - 1]!.publishedAt ?? '') : null

  for (const article of articles) {
    const key = article.publishedAt ? getMonthKey(article.publishedAt) : null
    if (key && key !== lastMonthKey) {
      result.push({ kind: 'month', label: getMonthLabel(article.publishedAt!), key })
      lastMonthKey = key
    }
    result.push({ kind: 'article', article })
  }

  return result
}

type SkeletonProps = { count?: number }

function Skeleton({ count = 3 }: SkeletonProps) {
  return (
    <div className="infinite-skeleton" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="infinite-skeleton__item" key={i}>
          <div className="infinite-skeleton__thumb" />
          <div className="infinite-skeleton__body">
            <div className="infinite-skeleton__line infinite-skeleton__line--short" />
            <div className="infinite-skeleton__line" />
            <div className="infinite-skeleton__line infinite-skeleton__line--medium" />
          </div>
        </div>
      ))}
    </div>
  )
}

function StreamCard({ article }: { article: Article }) {
  const sectionName = getSectionName(article.section)
  const section = article.section && typeof article.section === 'object' ? article.section : undefined
  const href = getArticleHref(article)
  const image = typeof article.featuredImage === 'object' ? article.featuredImage : null
  const byline = getArticleAuthors(article)
  const isOpinion = article.articleType === 'opinion' || article.articleType === 'editorial'

  return (
    <article className="editorial-card editorial-card--stream group">
      {image && (
        <Link aria-label={article.headline} className="editorial-card__image" href={href} tabIndex={-1}>
          <Media
            imgClassName="h-full w-full object-cover"
            preferredSize="small"
            resource={image}
            size="(max-width: 768px) 40vw, 18vw"
          />
        </Link>
      )}
      <div className="editorial-card__body">
        <div className="editorial-meta-row">
          {section && (
            <Link className="editorial-kicker" href={getSectionHref(section)}>
              {sectionName}
            </Link>
          )}
          {isOpinion && (
            <span className="editorial-type">{articleTypes[article.articleType]}</span>
          )}
        </div>
        <h2 className="editorial-card__headline">
          <Link href={href}>{article.headline}</Link>
        </h2>
        <div className="editorial-byline">
          {byline && <span>Por {byline}</span>}
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>{formatEditorialDate(article.publishedAt)}</time>
          )}
        </div>
      </div>
    </article>
  )
}

export function InfiniteArticleList({
  initialArticles,
  initialCursor,
  sectionSlug,
  limit = 12,
}: Props) {
  const [items, setItems] = useState<ListItem[]>(() =>
    buildItems(initialArticles, []),
  )
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [exhausted, setExhausted] = useState(!initialCursor)
  const allLoadedRef = useRef<Article[]>([...initialArticles])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)

  const fetchMore = useCallback(async () => {
    if (loadingRef.current || exhausted || !cursor) return
    loadingRef.current = true
    setLoading(true)

    try {
      const params = new URLSearchParams({ limit: String(limit), before: cursor })
      if (sectionSlug) params.set('section', sectionSlug)

      const res = await fetch(`/api/articles/stream?${params}`)
      if (!res.ok) throw new Error('Failed to load more articles')

      const data = (await res.json()) as { articles: Article[]; nextCursor: string | null }
      const next = data.articles ?? []

      if (next.length === 0) {
        setExhausted(true)
        return
      }

      const newItems = buildItems(next, allLoadedRef.current)
      allLoadedRef.current = [...allLoadedRef.current, ...next]
      setItems((prev) => [...prev, ...newItems])
      setCursor(data.nextCursor)
      if (!data.nextCursor) setExhausted(true)
    } catch (e) {
      console.error('[InfiniteArticleList] fetch error:', e)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [cursor, exhausted, limit, sectionSlug])

  // IntersectionObserver — triggers load when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || exhausted) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchMore()
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchMore, exhausted])

  return (
    <>
      <div className="infinite-list">
        {items.map((item, idx) => {
          if (item.kind === 'month') {
            return (
              <div className="infinite-date-band" key={`month-${item.key}`}>
                <span>{item.label}</span>
              </div>
            )
          }
          return <StreamCard article={item.article} key={item.article.id ?? idx} />
        })}
      </div>

      {loading && <Skeleton count={3} />}

      {!exhausted && (
        <div className="infinite-sentinel" ref={sentinelRef} aria-hidden="true">
          {!loading && (
            <button
              className="infinite-load-more"
              onClick={() => void fetchMore()}
              type="button"
            >
              Cargar más artículos
            </button>
          )}
        </div>
      )}

      {exhausted && items.length > 0 && (
        <p className="infinite-end-marker">Has llegado al final del archivo.</p>
      )}
    </>
  )
}
