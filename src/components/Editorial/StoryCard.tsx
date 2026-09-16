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
  showSummary = true,
  story,
  variant = 'compact',
}: {
  className?: string
  now: number
  showSummary?: boolean
  story: EditionStory
  variant?: 'compact' | 'lead' | 'stream'
}) {
  const href = safeHref(story.url)

  return (
    <article
      className={cn(
        'editorial-card group',
        variant === 'lead' && 'editorial-card--lead',
        variant === 'stream' && 'editorial-card--stream',
        className,
      )}
    >
      <div className="editorial-card__body">
        <div className="editorial-meta-row">
          <span className="editorial-kicker">{story.category}</span>
        </div>
        <h2 className="editorial-card__headline">
          {href ? (
            <a href={href} rel="noopener noreferrer" target="_blank">
              {story.title}
            </a>
          ) : (
            story.title
          )}
        </h2>
        {showSummary && story.excerpt && <p className="editorial-card__summary">{story.excerpt}</p>}
        <div className="editorial-byline">
          <span>{story.feedTitle}</span>
          <time dateTime={story.publishedAt}>{formatAge(story.publishedAt, now)}</time>
        </div>
        <StorySignals story={story} />
      </div>
    </article>
  )
}
