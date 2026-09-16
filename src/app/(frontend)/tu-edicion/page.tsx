import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import React from 'react'

import { SectionHeading } from '@/components/Editorial/SectionHeading'
import { formatAge, StoryCard } from '@/components/Editorial/StoryCard'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import { ReaderTokenRejected, ReaderUnavailable } from '@/lib/personalized/edition'
import { loadPersonalizedEdition } from '@/lib/personalized/load'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { formatEditorialDate } from '@/utilities/editorial'

import { disconnectReader } from './actions'

export const dynamic = 'force-dynamic'

const SUPPORT_STORIES = 4

// Loading lives outside the component: it reads the clock and may schedule the stale edition's refresh.
async function loadPage(cookieValue: string | undefined) {
  const now = Date.now()

  try {
    const loaded = await loadPersonalizedEdition(cookieValue, { now })
    if (loaded?.refresh) after(loaded.refresh)
    return { failure: null, loaded, now }
  } catch (error) {
    if (error instanceof ReaderTokenRejected)
      return { failure: 'rejected' as const, loaded: null, now }

    // Only a failure to reach panfleto is described as panfleto being down; our own bug is not.
    const unreachable =
      error instanceof ReaderUnavailable ||
      error instanceof MinifluxRequestError ||
      (error instanceof Error && ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name))
    console.error('[tu-edicion] could not build an edition', { message: String(error) })
    return {
      failure: unreachable ? ('unavailable' as const) : ('broken' as const),
      loaded: null,
      now,
    }
  }
}

export default async function PersonalizedEditionPage() {
  const cookieValue = (await cookies()).get(SESSION_COOKIE)?.value
  const reader = resolvePersonalizedReader(cookieValue)
  if (!reader) redirect('/')

  const { failure, loaded, now } = await loadPage(cookieValue)
  if (failure === 'rejected') redirect('/tu-edicion/salir')

  const edition = loaded?.edition
  const builtAt = loaded?.builtAt ?? now
  const [lead, ...rest] = edition?.front || []
  const support = rest.slice(0, SUPPORT_STORIES)
  const river = rest.slice(SUPPORT_STORIES)

  return (
    <div className="newspaper-home">
      <section className="front-context ep-container" aria-label="Tu edición">
        <p>{formatEditorialDate(new Date(now).toISOString(), { weekday: 'long' })}</p>
        <h1>Tu edición</h1>
        {edition && (
          <p>
            Hecha con tus fuentes: {edition.storyCount} historias de las últimas 24 horas, arriba
            las que publicaron varios de tus medios. Actualizada{' '}
            {formatAge(new Date(builtAt).toISOString(), now)}.
          </p>
        )}
        <form action={disconnectReader}>
          <p>
            Conectado como <strong>{reader.username}</strong> ·{' '}
            <button className="underline" type="submit">
              Salir
            </button>
          </p>
        </form>
      </section>

      {!edition ? (
        <section className="empty-state ep-container">
          <p>
            {failure === 'unavailable'
              ? 'panfleto no está respondiendo ahora mismo, así que no pudimos armar tu edición. Tu conexión está bien: no cambies tu token. Vuelve a intentarlo en unos minutos.'
              : 'Algo falló de nuestro lado al armar tu edición. Tu token está bien: no lo cambies. Vuelve a intentarlo en unos minutos.'}
          </p>
        </section>
      ) : !lead ? (
        <section className="empty-state ep-container">
          <p>Tus fuentes no publicaron nada en las últimas 24 horas.</p>
        </section>
      ) : (
        <>
          <section aria-label="Historia principal" className="lead-package ep-container">
            <StoryCard now={now} story={lead} variant="lead" />
            <div className="lead-package__support">
              {support.map((story) => (
                <StoryCard key={story.url} now={now} showSummary={false} story={story} />
              ))}
            </div>
          </section>

          {river.length > 0 && (
            <section className="home-river ep-container">
              <SectionHeading eyebrow="Portada">También hoy</SectionHeading>
              <div className="home-river__list">
                {river.map((story) => (
                  <StoryCard key={story.url} now={now} story={story} variant="stream" />
                ))}
              </div>
            </section>
          )}

          {edition.sections.length > 0 && (
            <section className="section-modules ep-container">
              {edition.sections.map((section) => (
                <div className="section-module" key={section.category}>
                  <SectionHeading>{section.category}</SectionHeading>
                  <div>
                    {section.stories.map((story) => (
                      <StoryCard key={story.url} now={now} showSummary={false} story={story} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Tu edición',
}
