'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { dayKeyOf, dayLabel, EDITION_TIME_ZONE, startOfDay } from '@/lib/personalized/days'
import type { FeedEntriesPage, ListedEntry, ReaderDay, ReaderDaysPage } from '@/lib/personalized/feeds'

import { SourceByline } from './StoryCard'
import { StoryImage } from './StoryImage'

// The lists that keep going past the edition: a source's entries and the days before today. Both load the
// next page when the reader nears the end, and keep a button for keyboards, screen readers and failures.

const DAY_PREVIEW = 30
// How far a "?hasta=" link may make the page walk on its own.
const MAX_RESTORE_DAYS = 14

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: EDITION_TIME_ZONE,
  }).format(new Date(iso))

export function EntryRow({
  entry,
  showSource = true,
  showThumb = false,
  showTime = true,
}: {
  entry: ListedEntry
  showSource?: boolean
  showThumb?: boolean
  showTime?: boolean
}) {
  const href = `/tu-edicion/articulo/${entry.id}`

  return (
    <article className={showThumb ? 'entry-row entry-row--thumb' : 'entry-row'}>
      {showTime && (
        <time className="entry-row__time" dateTime={entry.publishedAt}>
          {timeOf(entry.publishedAt)}
        </time>
      )}
      <div className="entry-row__body">
        <h3 className="entry-row__headline">
          <Link href={href} prefetch={false}>
            {entry.title}
          </Link>
        </h3>
        <div className="editorial-byline">
          {showSource ? (
            <SourceByline feedId={entry.feedId} feedTitle={entry.feedTitle} url={entry.url} />
          ) : (
            <a className="source-byline__out" href={entry.url} rel="noopener noreferrer" target="_blank">
              Original ↗
            </a>
          )}
          {!showTime && <time dateTime={entry.publishedAt}>{timeOf(entry.publishedAt)}</time>}
          {showSource ? <span>{entry.category}</span> : entry.readingTime > 0 && <span>{entry.readingTime} min</span>}
          {entry.unread && <span className="entry-row__unread">Sin leer</span>}
        </div>
      </div>
      {showThumb && (
        <Link aria-hidden className="entry-row__thumb" href={href} prefetch={false} tabIndex={-1}>
          <StoryImage placeholder seed={String(entry.id)} src={entry.imageUrl} />
        </Link>
      )}
    </article>
  )
}

// Asks for more when `target` comes within a screen of the viewport.
function useNearEnd(onNear: () => void, enabled: boolean) {
  const target = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = target.current
    if (!node || !enabled) return
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) onNear()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, onNear])

  return target
}

function SkeletonRows({ count = 3, thumb = false }: { count?: number; thumb?: boolean }) {
  return (
    <div aria-hidden className="entry-grid entry-grid--skeleton">
      {Array.from({ length: count }, (_, index) => (
        <div className={thumb ? 'entry-skeleton entry-skeleton--thumb' : 'entry-skeleton'} key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

type Status = 'error' | 'idle' | 'loading'

function MoreControl({
  done,
  doneLabel,
  label,
  onMore,
  status,
}: {
  done: boolean
  doneLabel: string
  label: string
  onMore: () => void
  status: Status
}) {
  if (done) return <p className="entry-more__end">{doneLabel}</p>

  return (
    <div className="entry-more" aria-live="polite">
      {status === 'error' && <p>No pudimos cargar más. Revisa tu conexión y vuelve a intentarlo.</p>}
      <button className="entry-more__button" disabled={status === 'loading'} onClick={onMore} type="button">
        {status === 'loading' ? 'Cargando…' : status === 'error' ? 'Reintentar' : label}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------
// A source's page: entries grouped under the day they were published, older pages appended by entry ID.

const groupByDay = (entries: ListedEntry[], now: number) => {
  const groups: Array<{ entries: ListedEntry[]; key: string; label: string }> = []
  for (const entry of entries) {
    const instant = new Date(entry.publishedAt).getTime()
    const key = dayKeyOf(instant)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.entries.push(entry)
    else groups.push({ entries: [entry], key, label: dayLabel(startOfDay(instant), now) })
  }
  return groups
}

export function SourceEntries({
  feedId,
  initialCursor,
  initialEntries,
  now,
  unreadOnly,
}: {
  feedId: number
  initialCursor: null | number
  initialEntries: ListedEntry[]
  now: number
  unreadOnly: boolean
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [cursor, setCursor] = useState(initialCursor)
  const [status, setStatus] = useState<Status>('idle')
  const busy = useRef(false)

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor) return
    busy.current = true
    setStatus('loading')
    try {
      const params = new URLSearchParams({ antes: String(cursor) })
      if (unreadOnly) params.set('estado', 'sin-leer')
      const response = await fetch(`/tu-edicion/fuente/${feedId}/entradas?${params}`)
      if (!response.ok) throw new Error(String(response.status))
      const page = (await response.json()) as FeedEntriesPage
      setEntries((current) => {
        const seen = new Set(current.map((entry) => entry.id))
        return [...current, ...page.entries.filter((entry) => !seen.has(entry.id))]
      })
      setCursor(page.nextCursor)
      setStatus('idle')
    } catch {
      setStatus('error')
    } finally {
      busy.current = false
    }
  }, [cursor, feedId, unreadOnly])

  const sentinel = useNearEnd(loadMore, Boolean(cursor) && status === 'idle')

  return (
    <>
      {groupByDay(entries, now).map((group) => (
        <section className="entry-day" key={group.key}>
          <h2 className="entry-day__title">
            {group.label}
            <span>{group.entries.length === 1 ? '1 entrada' : `${group.entries.length} entradas`}</span>
          </h2>
          <div className="entry-grid">
            {group.entries.map((entry) => (
              <EntryRow entry={entry} key={entry.id} showSource={false} showThumb showTime={false} />
            ))}
          </div>
        </section>
      ))}
      {status === 'loading' && <SkeletonRows count={4} thumb />}
      <div ref={sentinel} />
      {entries.length > 0 && (
        <MoreControl
          done={!cursor}
          doneLabel="No hay entradas más antiguas de esta fuente."
          label="Cargar entradas anteriores"
          onMore={loadMore}
          status={status}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------
// "Antes de hoy": after the edition, one calendar day at a time. The address remembers the last day shown
// (?hasta=2026-10-18), so coming back to that link walks back to it again.

function EarlierDay({ day, first }: { day: ReaderDay; first: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? day.entries : day.entries.slice(0, DAY_PREVIEW)
  const hidden = day.entries.length - shown.length

  return (
    <section aria-label={day.label} className="earlier-day" id={`dia-${day.key}`}>
      <div className={first ? 'day-divider day-divider--first' : 'day-divider'}>
        <span aria-hidden className="day-divider__rule" />
        <div className="day-divider__text">
          {first && <span className="editorial-kicker">Antes de hoy</span>}
          <h2>{day.label}</h2>
          <span>{day.total === 1 ? '1 entrada' : `${day.total} entradas`}</span>
        </div>
        <span aria-hidden className="day-divider__rule" />
      </div>
      <div className="entry-grid entry-grid--three">
        {shown.map((entry) => (
          <EntryRow entry={entry} key={entry.id} />
        ))}
      </div>
      {hidden > 0 && (
        <button className="earlier-day__expand" onClick={() => setExpanded(true)} type="button">
          Ver las {day.entries.length} entradas de este día
        </button>
      )}
    </section>
  )
}

export function EarlierDays({ before }: { before: number }) {
  const [days, setDays] = useState<ReaderDay[]>([])
  const [next, setNext] = useState<null | number>(before)
  const [status, setStatus] = useState<Status>('idle')
  const busy = useRef(false)
  const seen = useRef(new Set<number>())

  const loadDay = useCallback(async (cursor: number): Promise<ReaderDaysPage | null> => {
    if (busy.current) return null
    busy.current = true
    setStatus('loading')
    try {
      const response = await fetch(`/tu-edicion/dias?antes=${cursor}`)
      if (!response.ok) throw new Error(String(response.status))
      const page = (await response.json()) as ReaderDaysPage
      const day = page.day
      if (day) {
        // Neighbouring windows share a second at midnight; an entry shows once.
        const entries = day.entries.filter((entry) => !seen.current.has(entry.id))
        entries.forEach((entry) => seen.current.add(entry.id))
        setDays((current) => [...current, { ...day, entries }])
        const url = new URL(window.location.href)
        url.searchParams.set('hasta', day.key)
        window.history.replaceState(window.history.state, '', url)
      }
      setNext(page.next)
      setStatus('idle')
      return page
    } catch {
      setStatus('error')
      return null
    } finally {
      busy.current = false
    }
  }, [])

  const loadMore = useCallback(() => {
    if (next) void loadDay(next)
  }, [loadDay, next])

  // A shared or reloaded "?hasta=" link walks back to the day it names.
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('hasta')
    if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return
    let cancelled = false
    void (async () => {
      let cursor: null | number = before
      for (let step = 0; cursor && step < MAX_RESTORE_DAYS && !cancelled; step++) {
        const page: ReaderDaysPage | null = await loadDay(cursor)
        if (!page?.day || page.day.key <= target) break
        cursor = page.next
      }
      if (!cancelled) document.getElementById(`dia-${target}`)?.scrollIntoView({ block: 'start' })
    })()
    return () => {
      cancelled = true
    }
  }, [before, loadDay])

  const sentinel = useNearEnd(loadMore, Boolean(next) && status === 'idle')

  return (
    <div className="earlier-days ep-container">
      {days.map((day, index) => (
        <EarlierDay day={day} first={index === 0} key={day.key} />
      ))}
      {status === 'loading' && <SkeletonRows count={3} />}
      <div ref={sentinel} />
      <MoreControl
        done={!next}
        doneLabel="No hay entradas más antiguas en tus fuentes."
        label={days.length === 0 ? 'Ver los días anteriores' : 'Ver el día anterior'}
        onMore={loadMore}
        status={status}
      />
    </div>
  )
}
