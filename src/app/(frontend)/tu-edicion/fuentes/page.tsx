import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'

import { SourceIndex, type SourceIndexGroup } from '@/components/Editorial/SourceIndex'
import { hostOf } from '@/lib/personalized/aggregator'
import { fetchReaderFeeds, fetchReaderUnreadCounts } from '@/lib/personalized/feeds'
import { isUnauthorizedError } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const initialsOf = (title: string) =>
  title
    .replace(/^r\//i, '')
    .split(/[\s.\-_/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '·'

async function loadSources(token: string) {
  try {
    const [feeds, unread] = await Promise.all([
      fetchReaderFeeds(token),
      fetchReaderUnreadCounts(token).catch(() => ({}) as Record<string, number>),
    ])
    return { failure: null, feeds, unread }
  } catch (error) {
    if (isUnauthorizedError(error)) return { failure: 'rejected' as const }
    console.error('[tu-edicion] could not list sources', { message: String(error) })
    return { failure: 'unavailable' as const }
  }
}

export default async function SourcesPage() {
  const cookieValue = (await cookies()).get(SESSION_COOKIE)?.value
  const reader = resolvePersonalizedReader(cookieValue)
  if (!reader) redirect('/tu-edicion/conectar')

  const loaded = await loadSources(reader.key)
  if (loaded.failure === 'rejected') redirect('/tu-edicion/salir')

  const byCategory = new Map<string, SourceIndexGroup>()
  for (const feed of loaded.failure ? [] : loaded.feeds) {
    const unread = loaded.failure ? 0 : loaded.unread[String(feed.id)] || 0
    const group = byCategory.get(feed.category) || { category: feed.category, sources: [], unread: 0 }
    group.sources.push({
      host: hostOf(feed.siteUrl),
      id: feed.id,
      initials: initialsOf(feed.title),
      title: feed.title,
      unread,
    })
    group.unread += unread
    byCategory.set(feed.category, group)
  }
  // Busiest categories first, like the edition's sections; sources alphabetically inside each.
  const groups = [...byCategory.values()]
    .map((group) => ({
      ...group,
      sources: group.sources.sort((a, b) => a.title.localeCompare(b.title, 'es')),
    }))
    .sort((a, b) => b.sources.length - a.sources.length || a.category.localeCompare(b.category, 'es'))
  const total = groups.reduce((sum, group) => sum + group.sources.length, 0)

  return (
    <div className="source-index ep-container">
      <header className="source-index__header">
        <span className="editorial-kicker">Tus suscripciones en panfleto</span>
        <h1>Fuentes</h1>
        <p>
          {loaded.failure
            ? 'panfleto no está respondiendo ahora mismo, así que no pudimos listar tus fuentes. Vuelve a intentarlo en unos minutos.'
            : total === 0
              ? 'Todavía no sigues ninguna fuente en panfleto.'
              : `${total} ${total === 1 ? 'fuente' : 'fuentes'} en ${groups.length} ${groups.length === 1 ? 'categoría' : 'categorías'}.`}
        </p>
      </header>
      {groups.length > 0 && <SourceIndex groups={groups} />}
    </div>
  )
}

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Fuentes',
}
