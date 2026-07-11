'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

const PageClient: React.FC<{ articleId: number | string }> = ({ articleId }) => {
  /* Force the header to be dark mode while we have an image behind it */
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  }, [setHeaderTheme])

  useEffect(() => {
    const controller = new AbortController()

    window
      .fetch('/api/trending/view', {
        body: JSON.stringify({ articleId }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      })
      .catch(() => undefined)

    return () => controller.abort()
  }, [articleId])

  return <React.Fragment />
}

export default PageClient
