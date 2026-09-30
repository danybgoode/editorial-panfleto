import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import React, { Suspense } from 'react'

import { ArticleComments } from '@/components/Editorial/ArticleComments'
import { ArticleQuickActions } from '@/components/Editorial/ArticleQuickActions'
import { PaywallRail } from '@/components/Editorial/PaywallRail'
import { ReaderBody } from '@/components/Editorial/ReaderBody'
import { RelatedStories } from '@/components/Editorial/RelatedStories'
import { SourceEmbed } from '@/components/Editorial/SourceEmbed'
import { SourceEmbedGate } from '@/components/Editorial/SourceEmbedGate'
import { StorySignals } from '@/components/Editorial/StoryCard'
import { commentSourceLabel, fetchArticleCommentThread } from '@/lib/comments/thread'
import { hostOf } from '@/lib/personalized/aggregator'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import { loadPersonalizedEdition } from '@/lib/personalized/load'
import type { EditionStory } from '@/lib/personalized/ranking'
import { fetchReaderArticle } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { formatEditorialDateTime } from '@/utilities/editorial'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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

  const comments = await fetchArticleCommentThread(article.commentsUrl, article.url).catch((error) => {
    console.warn('[tu-edicion] could not load comments:', error)
    return null
  })

  return { article, comments, matchedStory, now, relatedStories }
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

  const { article, comments, matchedStory, now, relatedStories } = data
  const commentsHref = comments
    ? '#article-comments'
    : article.commentsUrl || undefined
  const sourceLabel = comments
    ? commentSourceLabel(comments.source, comments.commentsUrl)
    : article.feedTitle || 'la fuente'
  // We could not bring the text in (a teaser, a blocked scrape, a body that was only links): offer the
  // publisher's own page instead of a dead end.
  const needsSource = article.isThin || !article.content
  // Through an aggregator the feed is Techmeme but the page is the cited publisher's, so name the host.
  const publisherLabel = article.permalinkUrl
    ? hostOf(article.url) || 'la fuente'
    : article.feedTitle || hostOf(article.url) || 'la fuente'

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
          {article.permalinkUrl && (
            <a
              className="tu-edicion-source-link text-xs underline"
              href={article.permalinkUrl}
              rel="noopener noreferrer"
              target="_blank"
              title="Abrir el permalink del agregador"
            >
              Visto en {article.feedTitle} ↗
            </a>
          )}
          {commentsHref && (
            <a
              className="article-share__comments tu-edicion-source-link text-xs underline"
              href={commentsHref}
              rel={comments ? undefined : 'noopener noreferrer'}
              target={comments ? undefined : '_blank'}
            >
              {comments
                ? `Comentarios (${comments.thread.totalComments}) ↓`
                : 'Comentarios ↗'}
            </a>
          )}
        </aside>

        <div className="article-body-wrap">
          {article.content && <ReaderBody html={article.content} />}

          {needsSource ? (
            <Suspense
              fallback={<SourceEmbed sourceLabel={publisherLabel} url={article.url} verdict="pending" />}
            >
              <SourceEmbedGate sourceLabel={publisherLabel} url={article.url} />
            </Suspense>
          ) : (
            <PaywallRail articleURL={article.url} />
          )}

          {comments && (
            <div id="article-comments">
              <ArticleComments
                comments={comments.thread.children}
                commentsUrl={comments.commentsUrl}
                sourceLabel={sourceLabel}
                totalCount={comments.thread.totalComments}
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

        <RelatedStories now={now} stories={relatedStories} />
      </div>

      <ArticleQuickActions commentsHref={commentsHref} showComments={Boolean(commentsHref)} />
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
