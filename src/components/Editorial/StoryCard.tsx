import Link from 'next/link'
import React from 'react'

import type { EditionStory } from '@/lib/personalized/ranking'
import { cn } from '@/utilities/ui'

// ArticleCard's sibling for the personalized edition: the same newspaper classes, for a story that lives in
// the reader's own feeds rather than in Payload, so it links out to the publisher.

const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined)

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

  if (story.sources.length > 1)
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
  showImage = true,
  showSummary = true,
  story,
  variant = 'compact',
}: {
  className?: string
  now: number
  showImage?: boolean
  showSummary?: boolean
  story: EditionStory
  variant?: 'compact' | 'lead' | 'stream'
}) {
  const href = safeHref(story.url)
  const articleHref = story.id ? `/tu-edicion/articulo/${story.id}` : href

  return (
    <article
      className={cn(
        'editorial-card group',
        variant === 'lead' && 'editorial-card--lead',
        variant === 'stream' && 'editorial-card--stream',
        className,
      )}
    >
      {showImage && story.imageUrl && articleHref && (
        <Link
          aria-label={story.title}
          className="editorial-card__image"
          href={articleHref}
          tabIndex={-1}
        >
          <img
            alt={story.title}
            className="h-full w-full object-cover"
            loading={variant === 'lead' ? 'eager' : 'lazy'}
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
          <span>
            {story.feedTitle}
            {href && (
              <a
                aria-label={`Abrir en ${story.feedTitle}`}
                className="ml-1 text-xs text-[var(--ep-muted)] hover:text-[var(--ep-ink)] hover:underline inline-block"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                title="Abrir fuente original"
              >
                ↗
              </a>
            )}
          </span>
          <time dateTime={story.publishedAt}>{formatAge(story.publishedAt, now)}</time>
        </div>
        <StorySignals story={story} />
      </div>
    </article>
  )
}
