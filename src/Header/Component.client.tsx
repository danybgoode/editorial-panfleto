'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header, Section } from '@/payload-types'

import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
  dateLabel: string
  sections: Section[]
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data, dateLabel, sections }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
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

  return (
    <header className="site-header" {...(theme ? { 'data-theme': theme } : {})}>
      <div className="site-header__utility ep-container">
        <span>Edición digital</span>
        <time dateTime={new Date().toISOString()}>{dateLabel}</time>
      </div>
      <div className="site-header__masthead ep-container">
        <Link className="site-wordmark" href="/">
          Editorial Panfleto
        </Link>
      </div>
      <HeaderNav data={data} sections={sections} />
    </header>
  )
}
