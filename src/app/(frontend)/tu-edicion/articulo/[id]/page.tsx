import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { ArticleComments } from '@/components/Editorial/ArticleComments'
import { PaywallRail } from '@/components/Editorial/PaywallRail'
import { StoryCard, StorySignals } from '@/components/Editorial/StoryCard'
import {
  fetchHackerNewsThread,
  getHackerNewsItemId,
  type HNThread,
} from '@/lib/comments/hackernews'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import { loadPersonalizedEdition } from '@/lib/personalized/load'
import type { EditionStory } from '@/lib/personalized/ranking'
import { fetchReaderArticle } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { formatEditorialDateTime } from '@/utilities/editorial'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

async function loadArticleData(
  cookieValue: string | undefined,
  token: string,
  entryId: number,
) {
  const now = Date.now()
  const article = await fetchReaderArticle(token, entryId)

  let matchedStory: EditionStory | undefined
  let relatedStories: EditionStory[] = []

  try {
    const loaded = await loadPersonalizedEdition(cookieValue, { now })
    if (loaded?.edition) {
      const allStories = [
        ...loaded.edition.front,
        ...loaded.edition.sections.flatMap((sec) => sec.stories),
      ]
      matchedStory = allStories.find(
        (s) => s.id === entryId || (s.url && s.url === article.url),
      )
      relatedStories = loaded.edition.front
        .filter((s) => s.id !== entryId && s.url !== article.url)
        .slice(0, 4)
    }
  } catch (editionError) {
    console.warn('[tu-edicion] could not load background edition for article context:', editionError)
  }

  let commentsThread: HNThread | null = null
  const hnId = getHackerNewsItemId(article.commentsUrl, article.url)
  if (hnId) {
    try {
      commentsThread = await fetchHackerNewsThread(hnId)
    } catch (e) {
      console.warn('[tu-edicion] could not load comments:', e)
    }
  }

  return { article, commentsThread, matchedStory, now, relatedStories }
}

export default async function PersonalizedArticlePage({ params }: PageProps) {
  const cookieValue = (await cookies()).get(SESSION_COOKIE)?.value
  const reader = resolvePersonalizedReader(cookieValue)
  if (!reader) redirect('/tu-edicion/conectar')

  const { id: rawId } = await params
  const entryId = Number(rawId)
  if (!Number.isFinite(entryId) || entryId <= 0) notFound()

  let data: Awaited<ReturnType<typeof loadArticleData>>
  try {
    data = await loadArticleData(cookieValue, reader.key, entryId)
  } catch (error) {
    if (error instanceof MinifluxRequestError) {
      if (error.status === 401) redirect('/tu-edicion/salir')
      if (error.status === 404) notFound()
    }
    console.error(`[tu-edicion] failed to load article ${entryId}:`, error)
    throw error
  }

  const { article, commentsThread, matchedStory, now, relatedStories } = data

  return (
    <article className="article-page">
      <header className="article-header ep-container">
        <Link className="tu-edicion-back-link" href="/tu-edicion">
          ← Volver a Tu edición
        </Link>
        <div className="article-header__meta">
          <span className="editorial-kicker">{article.categoryTitle}</span>
        </div>
        <h1>{article.title}</h1>
        <div className="article-byline">
          <span>{article.feedTitle}</span>
          {article.author && <span>Por {article.author}</span>}
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>
              {formatEditorialDateTime(article.publishedAt)}
            </time>
          )}
          <span>{article.readingTime} min de lectura</span>
        </div>
        {matchedStory && <StorySignals story={matchedStory} />}
      </header>

      <div className="article-layout ep-container">
        <aside aria-label="Acciones del artículo" className="article-share">
          <Link className="tu-edicion-back-link" href="/tu-edicion">
            ← Portada
          </Link>
          <a
            className="tu-edicion-source-link text-xs underline"
            href={`https://app.panfleto.win/entry/${entryId}`}
            rel="noopener noreferrer"
            target="_blank"
            title="Abrir en Mi Lector"
          >
            Ver en Mi Lector ↗
          </a>
          <a
            className="tu-edicion-source-link text-xs underline"
            href={article.url}
            rel="noopener noreferrer"
            target="_blank"
            title="Abrir en fuente original"
          >
            Fuente original ↗
          </a>
          {article.commentsUrl && (
            <a
              className="tu-edicion-source-link text-xs underline"
              href={commentsThread ? '#article-comments' : article.commentsUrl}
              rel={commentsThread ? undefined : 'noopener noreferrer'}
              target={commentsThread ? undefined : '_blank'}
            >
              {commentsThread ? `Comentarios (${commentsThread.totalComments}) ↓` : 'Comentarios ↗'}
            </a>
          )}
        </aside>

        <div className="article-body-wrap">
          {article.isThin && (
            <PaywallRail articleURL={article.url} isThinNotice={true} />
          )}

          {article.content ? (
            <div
              className="payload-richtext"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          ) : (
            <div className="empty-state">
              <p>
                No se pudo obtener el texto completo de este artículo desde la fuente. Puedes intentar
                leerlo con las opciones de Paywall Bypass o abrir la fuente original.
              </p>
            </div>
          )}

          {/* Paywall rail told below the article, matching Miniflux */}
          <PaywallRail articleURL={article.url} />

          {commentsThread && (
            <div id="article-comments">
              <ArticleComments
                comments={commentsThread.children}
                commentsUrl={article.commentsUrl || `https://news.ycombinator.com/item?id=${commentsThread.id}`}
                totalCount={commentsThread.totalComments}
              />
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-[var(--ep-rule)] flex flex-wrap justify-between items-center gap-4 text-sm">
            <Link className="tu-edicion-back-link mb-0" href="/tu-edicion">
              ← Volver a Tu edición
            </Link>
            <a
              className="underline text-[var(--ep-muted)] hover:text-[var(--ep-ink)]"
              href={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Leer en la web de {article.feedTitle || 'la fuente'} ↗
            </a>
          </div>
        </div>

        {relatedStories.length > 0 && (
          <aside aria-label="Más de tu edición" className="article-aside news-rail">
            <h2>Más de tu edición</h2>
            <div>
              {relatedStories.map((related) => (
                <StoryCard
                  key={related.id ? String(related.id) : related.url}
                  now={now}
                  showSummary={false}
                  story={related}
                />
              ))}
            </div>
          </aside>
        )}
      </div>
    </article>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: rawId } = await params
  return {
    robots: { follow: false, index: false },
    title: `Artículo ${rawId} · Tu edición`,
  }
}
