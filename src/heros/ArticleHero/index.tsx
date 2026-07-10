import { formatDateTime } from 'src/utilities/formatDateTime'
import React from 'react'

import type { Article } from '@/payload-types'

import { Media } from '@/components/Media'
import { formatAuthors } from '@/utilities/formatAuthors'

export const ArticleHero: React.FC<{
  article: Article
}> = ({ article }) => {
  const { section, featuredImage, headline, populatedAuthors, publishedAt, subtitle } = article

  const hasAuthors =
    populatedAuthors && populatedAuthors.length > 0 && formatAuthors(populatedAuthors) !== ''

  return (
    <div className="relative -mt-[10.4rem] flex items-end">
      <div className="container z-10 relative lg:grid lg:grid-cols-[1fr_48rem_1fr] text-white pb-8">
        <div className="col-start-1 col-span-1 md:col-start-2 md:col-span-2">
          {section && typeof section === 'object' && (
            <div className="uppercase text-sm mb-6">{section.name || 'Untitled section'}</div>
          )}

          <div className="">
            <h1 className="mb-6 text-3xl md:text-5xl lg:text-6xl">{headline}</h1>
            {subtitle && <p className="text-xl md:text-2xl">{subtitle}</p>}
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-16">
            {hasAuthors && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm">Author</p>

                  <p>{formatAuthors(populatedAuthors)}</p>
                </div>
              </div>
            )}
            {publishedAt && (
              <div className="flex flex-col gap-1">
                <p className="text-sm">Date Published</p>

                <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-[80vh] select-none">
        {featuredImage && typeof featuredImage !== 'string' && (
          <Media fill priority imgClassName="-z-10 object-cover" resource={featuredImage} />
        )}
        <div className="absolute pointer-events-none left-0 bottom-0 w-full h-1/2 bg-linear-to-t from-black to-transparent" />
      </div>
    </div>
  )
}
