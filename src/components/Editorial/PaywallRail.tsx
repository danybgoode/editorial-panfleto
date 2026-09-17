import React from 'react'
import { cn } from '@/utilities/ui'

export function getPaywallBypassLinks(articleURL: string) {
  const safeURL = articleURL.trim()
  const unwallSlug = safeURL.replace(/^https?:\/\//i, '')
  return [
    {
      name: 'Archive.ph',
      url: `https://archive.ph/newest/${safeURL}`,
    },
    {
      name: 'Archive.is',
      url: `https://archive.is/newest/${safeURL}`,
    },
    {
      name: 'unwall.app',
      url: `https://unwall.app/${unwallSlug}`,
    },
  ]
}

export function PaywallRail({
  articleURL,
  className,
  isThinNotice = false,
}: {
  articleURL: string
  className?: string
  isThinNotice?: boolean
}) {
  const links = getPaywallBypassLinks(articleURL)

  return (
    <aside
      aria-label="Paywall Bypass"
      className={cn(
        'paywall-rail',
        isThinNotice && 'paywall-rail--notice',
        className,
      )}
    >
      <div className="paywall-rail__inner">
        <div className="paywall-rail__header">
          <span aria-hidden="true" className="paywall-rail__icon">
            🔓
          </span>
          <span className="paywall-rail__title">Paywall Bypass:</span>
        </div>
        <div className="paywall-rail__links">
          {links.map((link, index) => (
            <React.Fragment key={link.name}>
              {index > 0 && (
                <span aria-hidden="true" className="paywall-rail__sep">
                  •
                </span>
              )}
              <a
                className="paywall-rail__link"
                href={link.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {link.name}
              </a>
            </React.Fragment>
          ))}
        </div>
      </div>
      {isThinNotice && (
        <p className="paywall-rail__hint">
          El artículo parece estar recortado o detrás de un muro de pago. Puedes intentar leer el texto completo usando uno de los enlaces de bypass arriba o abrir la fuente original.
        </p>
      )}
    </aside>
  )
}
