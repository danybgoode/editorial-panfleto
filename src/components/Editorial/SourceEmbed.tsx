'use client'

import React, { useState } from 'react'

import type { EmbedVerdict } from '@/lib/personalized/embed'

import { getPaywallBypassLinks } from './PaywallRail'

// Shown under an article whose full text we could not bring in (the feed sent a teaser, the scraper was
// blocked, the body was nothing but links). It offers, in order: read the publisher's own page right here,
// open it on their site, or try one of the alternative-access links.
//
// "Read here" is an iframe of the publisher's page. It is only offered when the server asked the publisher and
// framing is not ruled out (see lib/personalized/embed.ts), and it loads on a tap, not on arrival: a
// third-party page brings its own ads and trackers, and a reader who only wanted the summary shouldn't pay
// for them. Pass `autoLoad` to flip that.
//
// verdict: 'allowed'  the publisher permits framing
//          'unknown'  the publisher could not be asked (bot wall, timeout): offer it, with the escape hatch
//          'blocked'  the publisher forbids framing: no embed, only the ways out
//          'pending'  still asking: the ways out, no embed yet

export function SourceEmbed({
  autoLoad = false,
  sourceLabel,
  url,
  verdict,
}: {
  autoLoad?: boolean
  sourceLabel: string
  url: string
  verdict: EmbedVerdict | 'pending'
}) {
  const canEmbed = verdict === 'allowed' || verdict === 'unknown'
  const [open, setOpen] = useState(autoLoad && verdict === 'allowed')
  const alternates = getPaywallBypassLinks(url)

  return (
    <section aria-label="Leer en la fuente" className="source-embed">
      <div className="source-embed__intro">
        <p className="source-embed__title">No pudimos traer el texto completo.</p>
        {verdict === 'blocked' && (
          <p className="source-embed__hint">
            {sourceLabel} no permite mostrar sus páginas dentro de otras. Ábrelo en su sitio o prueba
            un acceso alternativo.
          </p>
        )}
        {canEmbed && (
          <p className="source-embed__hint">
            Puedes leerlo aquí mismo, tal como lo publica {sourceLabel}.
          </p>
        )}

        <div className="source-embed__actions">
          {canEmbed && (
            <button
              aria-expanded={open}
              className="source-embed__button source-embed__button--primary"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              {open ? 'Cerrar vista' : 'Leer aquí'}
            </button>
          )}
          <a
            className="source-embed__button"
            href={url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Abrir en {sourceLabel} ↗
          </a>
        </div>

        <p className="source-embed__alternates">
          <span>Otras formas de leerlo:</span>
          {alternates.map((link) => (
            <a href={link.url} key={link.name} rel="noopener noreferrer" target="_blank">
              {link.name}
            </a>
          ))}
        </p>
      </div>

      {canEmbed && open && (
        <div className="source-embed__frame">
          <iframe
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            src={url}
            title={`Artículo en ${sourceLabel}`}
          />
          <p className="source-embed__fallback">
            ¿Se ve en blanco? Algunos medios no permiten mostrarse aquí.{' '}
            <a href={url} rel="noopener noreferrer" target="_blank">
              Ábrelo en una pestaña nueva
            </a>
            .
          </p>
        </div>
      )}
    </section>
  )
}
