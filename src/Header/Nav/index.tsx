'use client'

import React from 'react'

import type { Header as HeaderType, Section } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { Menu, SearchIcon, X } from 'lucide-react'
import { getSectionHref } from '@/utilities/editorial'

export const HeaderNav: React.FC<{ data: HeaderType; sections: Section[] }> = ({
  data,
  sections,
}) => {
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
      </nav>
      <nav aria-label="Navegación móvil" className={open ? 'mobile-nav is-open' : 'mobile-nav'}>
        <div className="ep-container">
          {nav}
          <Link href="/search" onClick={() => setOpen(false)}>
            Buscar
          </Link>
        </div>
      </nav>
    </div>
  )
}
