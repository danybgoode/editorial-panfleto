'use client'

import React, { useEffect, useState } from 'react'

export function ArticleQuickActions({
  commentsHref,
  showComments,
}: {
  commentsHref?: string
  showComments: boolean
}) {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > window.innerHeight * 0.6)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ behavior: reduced ? 'auto' : 'smooth', top: 0 })
  }

  if (!showComments && !showTop) return null

  return (
    <div className="article-quick-actions">
      {showComments && commentsHref && (
        <a
          aria-label="Ir a los comentarios"
          className="article-quick-actions__btn article-quick-actions__btn--comments"
          href={commentsHref}
        >
          Comentarios
        </a>
      )}
      {showTop && (
        <button
          aria-label="Volver arriba"
          className="article-quick-actions__btn"
          onClick={scrollTop}
          type="button"
        >
          Arriba
        </button>
      )}
    </div>
  )
}
