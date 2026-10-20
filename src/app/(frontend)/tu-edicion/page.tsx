import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import React from 'react'

import { EarlierDays } from '@/components/Editorial/EntryList'
import { RefreshEditionButton } from '@/components/Editorial/RefreshEditionButton'
import {
  formatAge,
  SourceByline,
  sourceHref,
  StoryCard,
} from '@/components/Editorial/StoryCard'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import { DAY_MS, ReaderTokenRejected, ReaderUnavailable } from '@/lib/personalized/edition'
import { loadPersonalizedEdition } from '@/lib/personalized/load'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import type { EditionStory } from '@/lib/personalized/ranking'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { formatEditorialDate, slugify } from '@/utilities/editorial'
import { cn } from '@/utilities/ui'

import { disconnectReader } from './actions'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const SIDE_STORIES = 2
const ROW_STORIES = 4
// A section with fewer stories than this is paired with another rather than given a full-width band.
const FULL_SECTION_MIN = 3
const SECTION_LAYOUTS = ['feature', 'tiles', 'columns'] as const

type SectionLayout = (typeof SECTION_LAYOUTS)[number] | 'list' | 'wide-list'
type EditionSectionData = { category: string; stories: EditionStory[] }

// Feature and tiles need four stories to fill their shape; a shorter section reads as columns instead.
const layoutFor = (section: EditionSectionData, index: number): SectionLayout => {
  const layout = SECTION_LAYOUTS[index % SECTION_LAYOUTS.length]
  return section.stories.length < ROW_STORIES ? 'columns' : layout
}

// Each full section takes the next layout in turn, so the page changes rhythm as it goes down.
function EditionSection({
  layout,
  now,
  section,
}: {
  layout: SectionLayout
  now: number
  section: EditionSectionData
}) {
  const [first, ...others] = section.stories
  const tiles = section.stories.slice(0, ROW_STORIES)
  const afterTiles = section.stories.slice(ROW_STORIES)

  return (
    <section
      aria-label={section.category}
      className={`edition-section edition-section--${layout}`}
    >
      <div className="edition-section__head">
        <h2>{section.category}</h2>
        <Link href={`/sections/${slugify(section.category)}`}>Todo en {section.category} →</Link>
      </div>

      {layout === 'feature' && first && (
        <div className="edition-section__body">
          <StoryCard now={now} story={first} variant="lead" />
          <div className="edition-section__list">
            {others.map((story) => (
              <StoryCard key={story.url} now={now} showSummary={false} story={story} variant="list" />
            ))}
          </div>
        </div>
      )}

      {layout === 'tiles' && (
        <>
          <div className="edition-section__tiles">
            {tiles.map((story) => (
              <StoryCard key={story.url} now={now} showSummary={false} story={story} />
            ))}
          </div>
          {afterTiles.length > 0 && (
            <div className="edition-section__columns edition-section__columns--two">
              {afterTiles.map((story) => (
                <StoryCard key={story.url} now={now} showImage={false} story={story} />
              ))}
            </div>
          )}
        </>
      )}

      {layout === 'columns' && (
        // Four stories sit two by two; in three columns one would be left alone on a row.
        <div
          className={cn(
            'edition-section__columns',
            section.stories.length === 4 && 'edition-section__columns--two',
          )}
        >
          {section.stories.map((story) => (
            <StoryCard key={story.url} now={now} showImage={false} story={story} />
          ))}
        </div>
      )}

      {(layout === 'list' || layout === 'wide-list') && (
        <div className="edition-section__list">
          {section.stories.map((story) => (
            <StoryCard key={story.url} now={now} showSummary={false} story={story} variant="list" />
          ))}
        </div>
      )}
    </section>
  )
}

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
  const left = rest.slice(0, SIDE_STORIES)
  const row = rest.slice(SIDE_STORIES, SIDE_STORIES + ROW_STORIES)
  const discussed = edition?.discussed || []
  const corroborated = edition?.corroborated || []
  // Stories left over from the front (a front longer than the layout holds) lead the first section.
  const overflow = rest.slice(SIDE_STORIES + ROW_STORIES)
  const sections = edition?.sections || []
  const fullSections = sections.filter((section) => section.stories.length >= FULL_SECTION_MIN)
  const shortSections = sections.filter((section) => section.stories.length < FULL_SECTION_MIN)
  if (overflow.length > 0) fullSections.unshift({ category: 'También hoy', stories: overflow })

  return (
    <div className="newspaper-home">
      <section className="front-context ep-container" aria-label="Tu edición">
        <p>{formatEditorialDate(new Date(now).toISOString(), { weekday: 'long' })}</p>
        <h1>Tu edición</h1>
        {edition && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p>
              Hecha con tus fuentes: {edition.storyCount} historias de las últimas 24 horas, arriba
              las que publicaron varios de tus medios. Actualizada{' '}
              {formatAge(new Date(builtAt).toISOString(), now)}.
            </p>
            <RefreshEditionButton />
          </div>
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
          <section
            aria-label="Portada"
            className={cn('edition-top ep-container', discussed.length > 0 && 'edition-top--rail')}
          >
            <div className="edition-top__lead">
              <StoryCard now={now} story={lead} variant="lead" />
            </div>
            {left.length > 0 && (
              <div className="edition-top__side">
                {left.map((story) => (
                  <StoryCard key={story.url} now={now} showImage={false} story={story} />
                ))}
              </div>
            )}
            {discussed.length > 0 && (
              <aside aria-label="Lo más comentado" className="edition-top__rail">
                <h2 className="rail-title">Lo más comentado</h2>
                <ol className="ranked-list">
                  {discussed.map((story, index) => (
                    <li key={story.url}>
                      <span aria-hidden className="ranked-list__n">
                        {index + 1}
                      </span>
                      <div>
                        <Link
                          className="ranked-list__title"
                          href={story.id ? `/tu-edicion/articulo/${story.id}` : story.url}
                          prefetch={false}
                        >
                          {story.title}
                        </Link>
                        <p className="editorial-byline">
                          <SourceByline feedId={story.feedId} feedTitle={story.feedTitle} />
                          <span>{story.comments} comentarios</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </section>

          {row.length > 0 && (
            <section aria-label="También en portada" className="edition-row ep-container">
              {row.map((story) => (
                <StoryCard key={story.url} now={now} showSummary={false} story={story} />
              ))}
            </section>
          )}

          {corroborated.length > 0 && (
            <section aria-labelledby="varios-medios" className="edition-band">
              <div className="ep-container">
                <div className="edition-band__head">
                  <h2 id="varios-medios">Lo que cuentan varios de tus medios</h2>
                  <p>La misma historia, publicada por más de una de tus fuentes</p>
                </div>
                <div className="edition-band__items">
                  {corroborated.map((story) => (
                    <article className="edition-band__item" key={story.url}>
                      <span className="editorial-kicker">{story.sources.length} medios</span>
                      <h3 className="editorial-card__headline">
                        <Link
                          href={story.id ? `/tu-edicion/articulo/${story.id}` : story.url}
                          prefetch={false}
                        >
                          {story.title}
                        </Link>
                      </h3>
                      {story.excerpt && <p className="editorial-card__summary">{story.excerpt}</p>}
                      <div className="source-chips">
                        {(story.sourceFeeds || []).map((source) => (
                          <Link href={sourceHref(source.feedId)} key={source.feedId} prefetch={false}>
                            {source.title}
                          </Link>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {(fullSections.length > 0 || shortSections.length > 0) && (
            <div className="edition-sections ep-container">
              {fullSections.map((section, index) => (
                <EditionSection
                  key={section.category}
                  layout={layoutFor(section, index)}
                  now={now}
                  section={section}
                />
              ))}
              {shortSections.length > 0 && (
                <div className="edition-pairs">
                  {shortSections.map((section, index) => (
                    <EditionSection
                      key={section.category}
                      layout={
                        shortSections.length % 2 === 1 && index === shortSections.length - 1
                          ? 'wide-list'
                          : 'list'
                      }
                      now={now}
                      section={section}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <EarlierDays before={new Date(edition.generatedAt).getTime() - DAY_MS} />
        </>
      )}
    </div>
  )
}

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Tu edición',
}
