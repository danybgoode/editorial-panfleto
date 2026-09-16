'use client'

import React from 'react'

import type { Header as HeaderType, Section } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { Menu, SearchIcon, X } from 'lucide-react'
import { getSectionHref } from '@/utilities/editorial'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'

// The personalized edition's front door (fluxonline personalized-edition). It points at the connect page,
// which also sends an already-connected reader on to their edition, so the header stays static and cached.
const EDITION_HREF = '/tu-edicion/conectar'

export const HeaderNav: React.FC<{
  data: HeaderType
  sections: Section[]
  showEditionLink: boolean
}> = ({ data, sections, showEditionLink }) => {
  const [open, setOpen] = React.useState(false)
  const navItems = data?.navItems || []
  const nav = (
    <>
      {sections.map((section) => (
        <Link href={getSectionHref(section)} key={section.id} onClick={() => setOpen(false)}>
          {section.name}
        </Link>
      ))}
      {navItems.map(({ link }, i) => {
        return <CMSLink key={i} {...link} appearance="link" />
      })}
    </>
  )

  return (
    <div className="site-nav-wrap">
      <nav aria-label="Secciones principales" className="site-nav ep-container">
        <div className="site-nav__links">{nav}</div>
        <div className="site-nav__tools">
          {showEditionLink && (
            <Link className="site-nav__edition" href={EDITION_HREF} prefetch={false}>
              Tu edición
            </Link>
          )}
          <ThemeSelector />
          <Link className="site-nav__search" href="/search">
            <span className="sr-only">Buscar</span>
            <SearchIcon aria-hidden className="w-5" />
          </Link>
          <button
            aria-expanded={open}
            aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'}
            className="site-nav__menu"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <X aria-hidden className="w-5" /> : <Menu aria-hidden className="w-5" />}
          </button>
        </div>
      </nav>
      <nav aria-label="Navegación móvil" className={open ? 'mobile-nav is-open' : 'mobile-nav'}>
        <div className="ep-container">
          {nav}
          {showEditionLink && (
            <Link href={EDITION_HREF} onClick={() => setOpen(false)} prefetch={false}>
              Tu edición
            </Link>
          )}
          <Link href="/search" onClick={() => setOpen(false)}>
            Buscar
          </Link>
        </div>
      </nav>
    </div>
  )
}
