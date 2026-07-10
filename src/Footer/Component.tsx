import { getCachedGlobal } from '@/utilities/getGlobals'
import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { CMSLink } from '@/components/Link'
import { getSectionHref, siteName } from '@/utilities/editorial'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const payload = await getPayload({ config: configPromise })
  const sections = await payload.find({
    collection: 'sections',
    depth: 0,
    limit: 8,
    overrideAccess: false,
    pagination: false,
    sort: 'displayOrder',
    where: {
      isActive: {
        equals: true,
      },
    },
  })

  const navItems = footerData?.navItems || []

  return (
    <footer className="site-footer">
      <div className="ep-container site-footer__grid">
        <Link className="site-footer__wordmark" href="/">
          {siteName}
        </Link>

        <nav aria-label="Secciones" className="site-footer__nav">
          <h2>Secciones</h2>
          {sections.docs.map((section) => (
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
