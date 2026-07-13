'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import type { Header, Section } from '@/payload-types'
import { siteName } from '@/utilities/editorial'

import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
  dateLabel: string
  dateTime: string
  sections: Section[]
}

export const HeaderClient: React.FC<HeaderClientProps> = ({
  data,
  dateLabel,
  dateTime,
  sections,
}) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const compactRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  useEffect(() => {
    const compactAt = 112
    const expandAt = 56

    const updateCompact = () => {
      const shouldCompact = compactRef.current
        ? window.scrollY > expandAt
        : window.scrollY > compactAt

      if (shouldCompact !== compactRef.current) {
        compactRef.current = shouldCompact
        setCompact(shouldCompact)
      }
    }

    const scheduleUpdate = () => {
      if (frameRef.current !== null) return

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        updateCompact()
      })
    }

    updateCompact()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return (
    <header
      className={compact ? 'site-header is-compact' : 'site-header'}
      {...(theme ? { 'data-theme': theme } : {})}
    >
      <div className="site-header__utility ep-container">
        <span>Edición digital</span>
        <time dateTime={dateTime}>{dateLabel}</time>
      </div>
      <div className="site-header__masthead ep-container">
        <Link className="site-wordmark" href="/">
          {siteName}
        </Link>
      </div>
      <HeaderNav data={data} sections={sections} />
    </header>
  )
}
