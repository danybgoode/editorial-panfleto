'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Article } from '@/payload-types'

import { Media } from '@/components/Media'

export type CardArticleData = Pick<
  Article,
  'featuredImage' | 'headline' | 'meta' | 'section' | 'slug' | 'summary'
>

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardArticleData
  relationTo?: 'articles'
  showSections?: boolean
  title?: string
}> = (props) => {
  const { card, link } = useClickableCard({})
  const { className, doc, relationTo, showSections, title: titleFromProps } = props

  const { slug, section, meta, headline, summary, featuredImage } = doc || {}
  const { description, image: socialImage } = meta || {}

  const titleToUse = titleFromProps || headline
  const imageToUse = featuredImage || socialImage
  const sanitizedDescription = (description || summary)?.replace(/\s/g, ' ')
  const href = `/${relationTo}/${slug}`

  return (
    <article
      className={cn(
        'border border-border rounded-lg overflow-hidden bg-card hover:cursor-pointer',
        className,
      )}
      ref={card.ref}
    >
      <div className="relative w-full ">
        {!imageToUse && <div className="">No image</div>}
        {imageToUse && typeof imageToUse !== 'string' && (
          <Media resource={imageToUse} size="33vw" />
        )}
      </div>
      <div className="p-4">
        {showSections && section && typeof section === 'object' && (
          <div className="uppercase text-sm mb-4">
            <Fragment>{section.name || 'Untitled section'}</Fragment>
          </div>
        )}
        {titleToUse && (
          <div className="prose">
            <h3>
              <Link className="not-prose" href={href} ref={link.ref}>
                {titleToUse}
              </Link>
            </h3>
          </div>
        )}
        {sanitizedDescription && <div className="mt-2"><p>{sanitizedDescription}</p></div>}
      </div>
    </article>
  )
}
