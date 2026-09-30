'use client'

import React, { useEffect, useRef } from 'react'

import { MIN_BODY_IMAGE_EDGE } from '@/lib/personalized/images'

// The article text, as sanitized HTML from the source. The server has already dropped images that are clearly
// furniture (share icons, logos, tracking pixels) by URL; this handles what only a browser can know:
//
// - a picture that fails to load (broken link, hotlink refused) is removed instead of leaving a broken-image
//   icon and a gap, together with its <figure> and the <a> around it;
// - a picture that loads but is icon-sized is removed too.
//
// `error` does not bubble, but it does travel the capture phase, so one listener on the wrapper sees them all,
// including images that were still loading when this mounted. Images that had already failed before hydration
// have fired their event already, so the effect also checks each image's `complete` state.

const hide = (image: HTMLImageElement) => {
  const figure = image.closest('figure')
  const link = image.closest('a')

  if (figure && figure.querySelectorAll('img:not([hidden])').length <= 1) {
    figure.hidden = true
    return
  }
  if (link && !link.textContent?.trim() && link.querySelectorAll('img:not([hidden])').length <= 1) {
    link.hidden = true
    return
  }
  image.hidden = true
}

const tooSmall = (image: HTMLImageElement) =>
  image.naturalWidth > 0 &&
  (image.naturalWidth <= MIN_BODY_IMAGE_EDGE || image.naturalHeight <= MIN_BODY_IMAGE_EDGE)

export function ReaderBody({ className = 'payload-richtext', html }: { className?: string; html: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const onError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) hide(event.target)
    }
    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement && tooSmall(event.target)) hide(event.target)
    }

    root.addEventListener('error', onError, true)
    root.addEventListener('load', onLoad, true)

    for (const image of Array.from(root.querySelectorAll('img'))) {
      if (!image.complete) continue
      if (image.naturalWidth === 0 || tooSmall(image)) hide(image)
    }

    return () => {
      root.removeEventListener('error', onError, true)
      root.removeEventListener('load', onLoad, true)
    }
  }, [html])

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} ref={ref} />
}
