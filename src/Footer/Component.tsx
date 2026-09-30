import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { CMSLink } from '@/components/Link'
import { getSectionHref, siteName } from '@/utilities/editorial'
import { resolveNavSections } from '@/utilities/navSections'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const sections = await resolveNavSections()
  const navItems = footerData?.navItems || []

  return (
    <footer className="site-footer">
      <div className="ep-container site-footer__grid">
        <Link className="site-footer__wordmark" href="/">
          {siteName}
        </Link>

        <nav aria-label="Secciones" className="site-footer__nav">
          <h2>Secciones</h2>
          {sections.map((section) => (
            <Link href={getSectionHref(section)} key={section.id}>
              {section.name}
            </Link>
          ))}
        </nav>

        {navItems.length > 0 && (
          <nav aria-label="Información" className="site-footer__nav">
            <h2>Información</h2>
            {navItems.map(({ link }, i) => {
              return <CMSLink key={i} {...link} />
            })}
          </nav>
        )}
      </div>
      <div className="ep-container site-footer__bottom">
        <p>© {new Date().getFullYear()} {siteName}.</p>
        <p>Periodismo, ensayo y vida pública en edición digital.</p>
      </div>
    </footer>
  )
}
