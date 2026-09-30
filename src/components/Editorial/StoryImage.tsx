'use client'

import React, { useEffect, useRef, useState } from 'react'

import { isUsableImageUrl, MIN_CARD_IMAGE_WIDTH } from '@/lib/personalized/images'

import { StoryPlaceholder } from './StoryPlaceholder'

// The picture for a story card. It shows the source's image only while there is every reason to trust it,
// and otherwise one of our placeholders, so a card never shows a broken-image icon, a share button or a
// blurry thumbnail stretched across the column:
//
// - the URL is missing or looks like furniture (checked before anything is requested);
// - the browser reports the load failed (onError);
// - the image loaded but is too small to stretch (onLoad);
// - the image already failed before React attached its handlers (the effect checks `complete`).

export function StoryImage({
  className = 'story-image',
  eager = false,
  placeholder = true,
  seed,
  src,
}: {
  className?: string
  eager?: boolean
  // When false, a story without a usable picture renders nothing instead of a placeholder.
  placeholder?: boolean
  // Anything stable about the story (its id or URL): the placeholder is chosen from it.
  seed: string
  src?: string
}) {
  const ref = useRef<HTMLImageElement>(null)
  const [rejected, setRejected] = useState<string>()
  const usable = isUsableImageUrl(src)

  const judge = (image: HTMLImageElement) => {
    if (!image.complete) return
    if (image.naturalWidth < MIN_CARD_IMAGE_WIDTH) setRejected(src)
  }

  useEffect(() => {
    if (ref.current) judge(ref.current)
    // `judge` closes over `src`, which is the only thing that should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!usable || rejected === src) {
    return placeholder ? <StoryPlaceholder className={className} seed={seed} /> : null
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote feed images have no known host to allow-list
    <img
      alt=""
      className={className}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setRejected(src)}
      onLoad={(event) => judge(event.currentTarget)}
      ref={ref}
      referrerPolicy="no-referrer"
      src={src}
    />
  )
}
