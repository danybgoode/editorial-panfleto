import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { SourceEntries } from '@/components/Editorial/EntryList'
import { formatAge, sourceHref } from '@/components/Editorial/StoryCard'
import { StoryImage } from '@/components/Editorial/StoryImage'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import { hostOf } from '@/lib/personalized/aggregator'
import {
  fetchReaderFeed,
  fetchReaderFeedEntries,
  fetchReaderFeeds,
  type ListedEntry,
} from '@/lib/personalized/feeds'
import { isUnauthorizedError } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const STACK_SIZE = 4
const OTHER_SOURCES = 6
const MANAGE_HREF = (feedId: number) => `https://app.panfleto.win/feed/${feedId}/entries`

type PageProps = {
  params: Promise<{ feedId: string }>
  searchParams: Promise<{ estado?: string }>
}

const initialsOf = (title: string) =>
  title
    .replace(/^r\//i, '')
    .split(/[\s.\-_/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '·'

// Loading lives outside the component, which keeps the clock read out of render.
async function loadSource(token: string, feedId: number, unreadOnly: boolean) {
  const now = Date.now()
  try {
    const [feed, page, feeds] = await Promise.all([
      fetchReaderFeed(token, feedId),
      fetchReaderFeedEntries(token, feedId, { unreadOnly }),
      fetchReaderFeeds(token).catch(() => []),
    ])
    return { failure: null, feed, feeds, now, page }
  } catch (error) {
    if (error instanceof MinifluxRequestError && error.status === 404)
      return { failure: 'missing' as const }
    if (isUnauthorizedError(error)) return { failure: 'rejected' as const }
    console.error('[tu-edicion] could not load a source', { feedId, message: String(error) })
    return { failure: 'unavailable' as const }
  }
}

function LeadEntry({ entry, now }: { entry: ListedEntry; now: number }) {
  const href = `/tu-edicion/articulo/${entry.id}`
  return (
    <article className="editorial-card editorial-card--lead">
      <Link aria-hidden className="editorial-card__image" href={href} prefetch={false} tabIndex={-1}>
        <StoryImage eager placeholder seed={String(entry.id)} src={entry.imageUrl} />
      </Link>
      <div className="editorial-card__body">
        <span className="editorial-kicker">{formatAge(entry.publishedAt, now)}</span>
        <h2 className="editorial-card__headline">
          <Link href={href} prefetch={false}>
            {entry.title}
          </Link>
        </h2>
        {entry.excerpt && <p className="editorial-card__summary">{entry.excerpt}</p>}
        <div className="editorial-byline">
          {entry.readingTime > 0 && <span>{entry.readingTime} min de lectura</span>}
          <a className="source-byline__out" href={entry.url} rel="noopener noreferrer" target="_blank">
            Original ↗
          </a>
        </div>
      </div>
    </article>
  )
}

export default async function SourcePage({ params, searchParams }: PageProps) {
  const cookieValue = (await cookies()).get(SESSION_COOKIE)?.value
  const reader = resolvePersonalizedReader(cookieValue)
  if (!reader) redirect('/tu-edicion/conectar')

  const feedId = Number((await params).feedId)
  if (!Number.isInteger(feedId) || feedId <= 0) notFound()
  const unreadOnly = (await searchParams).estado === 'sin-leer'

  const loaded = await loadSource(reader.key, feedId, unreadOnly)
  if (loaded.failure === 'missing') notFound()
  if (loaded.failure === 'rejected') redirect('/tu-edicion/salir')
  if (loaded.failure === 'unavailable') {
    return (
      <div className="source-view ep-container">
        <section className="empty-state">
          <p>
            panfleto no está respondiendo ahora mismo, así que no pudimos abrir esta fuente. Vuelve a
            intentarlo en unos minutos.
          </p>
        </section>
      </div>
    )
  }

  const { feed, feeds, now, page } = loaded
  const [lead, ...rest] = page.entries
  const stack = rest.slice(0, STACK_SIZE)
  const river = rest.slice(STACK_SIZE)
  const host = feed.siteUrl ? hostOf(feed.siteUrl) : ''
  const others = feeds
    .filter((other) => other.category === feed.category && other.id !== feed.id)
    .sort((a, b) => a.title.localeCompare(b.title, 'es'))
    .slice(0, OTHER_SOURCES)
  const base = sourceHref(feed.id)

  return (
    <div className="source-view ep-container">
      <nav aria-label="Ruta" className="source-view__crumbs">
        <Link href="/tu-edicion/fuentes">Fuentes</Link>
        <span aria-hidden>›</span>
        <Link href={`/tu-edicion/fuentes#${encodeURIComponent(feed.category)}`}>{feed.category}</Link>
        <span aria-hidden>›</span>
        <span>{feed.title}</span>
      </nav>

      <header className="source-view__header">
        <div aria-hidden className="source-view__mark">
          {initialsOf(feed.title)}
        </div>
        <div className="source-view__title">
          <span className="editorial-kicker">Fuente · {feed.category}</span>
          <h1>{feed.title}</h1>
          <p>
            {host && <span>{host}</span>}
            <span>
              {page.total === 1 ? '1 entrada' : `${page.total} entradas`}
              {unreadOnly ? ' sin leer' : ' guardadas'}
            </span>
            {lead && <span>última {formatAge(lead.publishedAt, now)}</span>}
          </p>
        </div>
        <div className="source-view__actions">
          {feed.siteUrl && (
            <a className="pill-link" href={feed.siteUrl} rel="noopener noreferrer" target="_blank">
              Abrir el sitio ↗
            </a>
          )}
          <a className="pill-link" href={MANAGE_HREF(feed.id)} rel="noopener noreferrer" target="_blank">
            Gestionar en panfleto
          </a>
        </div>
      </header>

      <div className="source-view__filters" role="group" aria-label="Qué entradas mostrar">
        <Link aria-current={!unreadOnly ? 'page' : undefined} className="pill-link" href={base}>
          Todo
        </Link>
        <Link
          aria-current={unreadOnly ? 'page' : undefined}
          className="pill-link"
          href={`${base}?estado=sin-leer`}
        >
          Sin leer
        </Link>
      </div>

      <div className="source-view__layout">
        <div className="source-view__main">
          {!lead ? (
            <section className="empty-state">
              <p>
                {unreadOnly
                  ? 'Ya leíste todo lo de esta fuente.'
                  : 'Esta fuente todavía no tiene entradas guardadas en panfleto.'}
              </p>
            </section>
          ) : (
            <>
              <section aria-label={`Lo último de ${feed.title}`} className="source-view__front">
                <LeadEntry entry={lead} now={now} />
                {stack.length > 0 && (
                  <div className="source-view__stack">
                    {stack.map((entry) => (
                      <article className="source-view__stack-item" key={entry.id}>
                        <span className="editorial-byline">{formatAge(entry.publishedAt, now)}</span>
                        <h3 className="entry-row__headline">
                          <Link href={`/tu-edicion/articulo/${entry.id}`} prefetch={false}>
                            {entry.title}
                          </Link>
                        </h3>
                        {entry.excerpt && <p className="editorial-card__summary">{entry.excerpt}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <SourceEntries
                feedId={feed.id}
                initialCursor={page.nextCursor}
                initialEntries={river}
                key={unreadOnly ? 'unread' : 'all'}
                now={now}
                unreadOnly={unreadOnly}
              />
            </>
          )}
        </div>

        {others.length > 0 && (
          <aside aria-label={`Otras fuentes en ${feed.category}`} className="source-view__rail">
            <h2 className="rail-title">Otras fuentes en {feed.category}</h2>
            <ul>
              {others.map((other) => (
                <li key={other.id}>
                  <Link href={sourceHref(other.id)} prefetch={false}>
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="rail-more" href="/tu-edicion/fuentes">
              Todas tus fuentes →
            </Link>
          </aside>
        )}
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Fuente',
}
