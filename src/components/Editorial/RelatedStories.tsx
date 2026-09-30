import Link from 'next/link'
import React from 'react'

import type { EditionStory } from '@/lib/personalized/ranking'

import { formatAge, safeHref } from './StoryCard'
import { StoryImage } from './StoryImage'

// "Más de tu edición" at the foot of an article. Picture on top, text underneath: on a phone the headline gets
// the full width instead of what is left beside a thumbnail. It has its own classes on purpose. It used to
// borrow `.editorial-card` and `.news-rail`, whose grid rules out-ranked the overrides written for it and
// pushed the headline into the 2rem counter column, one letter wide.

function StoryLink({
  children,
  className,
  href,
  internal,
  ...rest
}: {
  'aria-hidden'?: boolean
  children: React.ReactNode
  className?: string
  href: string
  internal: boolean
  tabIndex?: number
}) {
  if (internal) {
    return (
      <Link className={className} href={href} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a className={className} href={href} rel="noopener noreferrer" target="_blank" {...rest}>
      {children}
    </a>
  )
}

export function RelatedStories({ now, stories }: { now: number; stories: EditionStory[] }) {
  const items = stories.flatMap((story) => {
    const internal = Boolean(story.id)
    const href = story.id ? `/tu-edicion/articulo/${story.id}` : safeHref(story.url)
    return href ? [{ href, internal, story }] : []
  })

  if (items.length === 0) return null

  return (
    <aside aria-labelledby="related-stories-title" className="related-stories">
      <h2 className="related-stories__title" id="related-stories-title">
        Más de tu edición
      </h2>
      <ul className="related-stories__list">
        {items.map(({ href, internal, story }) => (
          <li className="related-story" key={story.id ? String(story.id) : story.url}>
            <StoryLink
              aria-hidden
              className="related-story__media"
              href={href}
              internal={internal}
              tabIndex={-1}
            >
              <StoryImage seed={String(story.id ?? story.url)} src={story.imageUrl} />
            </StoryLink>
            <div className="related-story__body">
              <span className="editorial-kicker">{story.category}</span>
              <h3 className="related-story__headline">
                <StoryLink href={href} internal={internal}>
                  {story.title}
                </StoryLink>
              </h3>
              <p className="related-story__meta">
                <span>{story.feedTitle}</span>
                <time dateTime={story.publishedAt}>{formatAge(story.publishedAt, now)}</time>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
