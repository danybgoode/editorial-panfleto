import Link from 'next/link'
import React from 'react'

import { isUsableImageUrl } from '@/lib/personalized/images'
import type { EditionStory } from '@/lib/personalized/ranking'
import { cn } from '@/utilities/ui'

import { StoryImage } from './StoryImage'

// ArticleCard's sibling for the personalized edition: the same newspaper classes, for a story that lives in
// the reader's own feeds rather than in Payload, so it links out to the publisher.

export const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined)

export const sourceHref = (feedId: number) => `/tu-edicion/fuente/${feedId}`

// A source's name links to its page; the arrow beside it opens the story at the publisher.
export function SourceByline({
  feedId,
  feedTitle,
  url,
}: {
  feedId?: number
  feedTitle: string
  url?: string
}) {
  const href = url ? safeHref(url) : undefined
  return (
    <span className="source-byline">
      {feedId ? (
        <Link className="source-byline__name" href={sourceHref(feedId)} prefetch={false}>
          {feedTitle}
        </Link>
      ) : (
        feedTitle
      )}
      {href && (
        <a
          aria-label={`Abrir en ${feedTitle}`}
          className="source-byline__out"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
          title="Abrir en el sitio original"
        >
          ↗
        </a>
      )}
    </span>
  )
}

export const formatAge = (publishedAt: string, now: number) => {
  const minutes = Math.max(0, Math.round((now - new Date(publishedAt).getTime()) / 60_000))
  if (Number.isNaN(minutes)) return ''
  if (minutes < 60) return `hace ${minutes} min`
  return `hace ${Math.round(minutes / 60)} h`
}

// Which signal placed the story, as the spike's rendered edition showed it.
export function StorySignals({ story }: { story: EditionStory }) {
  const commentsHref = safeHref(story.commentsUrl)
  const reasons: React.ReactNode[] = []

  if (story.sourceFeeds && story.sourceFeeds.length > 1) {
    reasons.push(
      <React.Fragment key="sources">
        {story.sourceFeeds.length} medios:{' '}
        {story.sourceFeeds.map((source, index) => (
          <React.Fragment key={source.feedId}>
            {index > 0 && ', '}
            <Link href={sourceHref(source.feedId)} prefetch={false}>
              {source.title}
            </Link>
          </React.Fragment>
        ))}
      </React.Fragment>,
    )
  } else if (story.sources.length > 1)
    reasons.push(`${story.sources.length} medios: ${story.sources.join(', ')}`)
  if (story.comments > 0) {
    reasons.push(
      commentsHref ? (
        <a href={commentsHref} key="hn" rel="noopener noreferrer" target="_blank">
          {story.comments} comentarios en HN
        </a>
      ) : (
        `${story.comments} comentarios en HN`
      ),
    )
  }
  if (reasons.length === 0) reasons.push('reciente')

  return (
    <p className="editorial-byline">
      <span>
        Por qué está aquí:{' '}
        {reasons.map((reason, index) => (
          <React.Fragment key={index}>
            {index > 0 && ' · '}
            {reason}
          </React.Fragment>
        ))}
      </span>
    </p>
  )
}

export function StoryCard({
  className,
  now,
  placeholder = true,
  showImage = true,
  showSummary = true,
  story,
  variant = 'compact',
}: {
  className?: string
  now: number
  // Show one of our placeholders when the story has no usable picture (false: no image slot at all).
  placeholder?: boolean
  showImage?: boolean
  showSummary?: boolean
  story: EditionStory
  // list: a row with a small square picture on the right, at every width.
  variant?: 'compact' | 'lead' | 'list' | 'stream'
}) {
  const href = safeHref(story.url)
  const articleHref = story.id ? `/tu-edicion/articulo/${story.id}` : href

  return (
    <article
      className={cn(
        'editorial-card group',
        variant === 'lead' && 'editorial-card--lead',
        variant === 'stream' && 'editorial-card--stream',
        variant === 'list' && 'editorial-card--list',
        className,
      )}
    >
      {showImage && articleHref && (placeholder || isUsableImageUrl(story.imageUrl)) && (
        <Link
          aria-label={story.title}
          className="editorial-card__image"
          href={articleHref}
          tabIndex={-1}
        >
          <StoryImage
            eager={variant === 'lead'}
            placeholder={placeholder}
            seed={String(story.id ?? story.url)}
            src={story.imageUrl}
          />
        </Link>
      )}
      <div className="editorial-card__body">
        <div className="editorial-meta-row">
          <span className="editorial-kicker">{story.category}</span>
        </div>
        <h2 className="editorial-card__headline">
          {story.id ? (
            <Link href={`/tu-edicion/articulo/${story.id}`}>{story.title}</Link>
          ) : href ? (
            <a href={href} rel="noopener noreferrer" target="_blank">
              {story.title}
            </a>
          ) : (
            story.title
          )}
        </h2>
        {showSummary && story.excerpt && <p className="editorial-card__summary">{story.excerpt}</p>}
        <div className="editorial-byline">
          <SourceByline feedId={story.feedId} feedTitle={story.feedTitle} url={story.url} />
          <time dateTime={story.publishedAt}>{formatAge(story.publishedAt, now)}</time>
        </div>
        <StorySignals story={story} />
      </div>
    </article>
  )
}
