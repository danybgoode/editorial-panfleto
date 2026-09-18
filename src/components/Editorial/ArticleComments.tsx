'use client'

import React, { useState } from 'react'
import type { HNComment } from '@/lib/comments/hackernews'
import { countDescendantComments } from '@/lib/comments/hackernews'

function formatCommentAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  if (Number.isNaN(diffMs)) return ''
  const minutes = Math.max(0, Math.round(diffMs / 60_000))
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

function CommentNode({
  comment,
  forceCollapseAll,
  forceExpandAll,
}: {
  comment: HNComment
  forceCollapseAll: number
  forceExpandAll: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [lastActionTimestamp, setLastActionTimestamp] = useState(0)

  // React to global collapse / expand triggers
  React.useEffect(() => {
    if (forceCollapseAll > lastActionTimestamp) {
      setCollapsed(true)
      setLastActionTimestamp(forceCollapseAll)
    }
  }, [forceCollapseAll, lastActionTimestamp])

  React.useEffect(() => {
    if (forceExpandAll > lastActionTimestamp) {
      setCollapsed(false)
      setLastActionTimestamp(forceExpandAll)
    }
  }, [forceExpandAll, lastActionTimestamp])

  const repliesCount = (comment.children || []).reduce(
    (acc, child) => acc + countDescendantComments(child),
    0,
  )

  // If deleted and no children, don't display
  if (!comment.text && (!comment.children || comment.children.length === 0)) {
    return null
  }

  return (
    <div className="hn-comment flex flex-col gap-1.5 text-sm py-1.5" id={`comment-${comment.id}`}>
      <div className="hn-comment-header flex items-center gap-2 text-xs text-[var(--ep-muted)]">
        <button
          aria-expanded={!collapsed}
          className="font-mono text-xs px-1 py-0.5 rounded border border-[var(--ep-rule)] hover:bg-[var(--ep-paper-muted)] cursor-pointer text-[var(--ep-ink)] select-none"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir comentario' : 'Colapsar comentario'}
          type="button"
        >
          {collapsed ? '[+]' : '[–]'}
        </button>

        <span className="font-semibold text-[var(--ep-ink)]">
          {comment.author || '[usuario eliminado]'}
        </span>

        {comment.created_at && (
          <time dateTime={comment.created_at}>{formatCommentAge(comment.created_at)}</time>
        )}

        {collapsed && repliesCount > 0 && (
          <span className="italic text-[var(--ep-muted)]">
            ({repliesCount} {repliesCount === 1 ? 'respuesta' : 'respuestas'} colapsadas)
          </span>
        )}
      </div>

      {!collapsed && (
        <>
          {comment.text && (
            <div
              className="hn-comment-body prose prose-sm max-w-none text-[var(--ep-ink)] leading-relaxed [&>p]:mb-2 [&_a]:text-[var(--ep-accent)] [&_a]:underline [&_pre]:overflow-x-auto [&_pre]:bg-[var(--ep-paper-muted)] [&_pre]:p-2 [&_pre]:rounded"
              dangerouslySetInnerHTML={{ __html: comment.text }}
            />
          )}

          {comment.children && comment.children.length > 0 && (
            <div className="hn-comment-replies border-l-2 border-[var(--ep-rule)] pl-3 sm:pl-4 mt-2 flex flex-col gap-2.5">
              {comment.children.map((child) => (
                <CommentNode
                  comment={child}
                  forceCollapseAll={forceCollapseAll}
                  forceExpandAll={forceExpandAll}
                  key={child.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ArticleComments({
  comments,
  commentsUrl,
  totalCount,
}: {
  comments: HNComment[]
  commentsUrl?: string
  totalCount: number
}) {
  const [forceCollapseTrigger, setForceCollapseTrigger] = useState(0)
  const [forceExpandTrigger, setForceExpandTrigger] = useState(0)

  if (!comments || comments.length === 0) {
    return (
      <section aria-label="Comentarios" className="article-comments-section mt-10 pt-6 border-t border-[var(--ep-rule)]">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-[var(--ep-ink)]">
            Comentarios
          </h2>
          {commentsUrl && (
            <a
              className="text-xs text-[var(--ep-muted)] hover:text-[var(--ep-ink)] underline"
              href={commentsUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Ver en Hacker News ↗
            </a>
          )}
        </div>
        <p className="text-sm text-[var(--ep-muted)]">
          Esta publicación aún no tiene comentarios registrados.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Comentarios" className="article-comments-section mt-10 pt-6 border-t border-[var(--ep-rule)]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-2 border-b border-[var(--ep-rule)]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--ep-ink)] flex items-center gap-2">
            <span>Comentarios de Hacker News</span>
            <span className="text-sm font-normal text-[var(--ep-muted)]">
              ({totalCount})
            </span>
          </h2>
          <p className="text-xs text-[var(--ep-muted)] mt-0.5">
            Lectura en línea. Usa [-] y [+] para colapsar y expandir hilos de discusión.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            className="hover:underline text-[var(--ep-muted)] hover:text-[var(--ep-ink)] cursor-pointer"
            onClick={() => setForceCollapseTrigger(Date.now())}
            type="button"
          >
            Colapsar todos
          </button>
          <span className="text-[var(--ep-rule)]">•</span>
          <button
            className="hover:underline text-[var(--ep-muted)] hover:text-[var(--ep-ink)] cursor-pointer"
            onClick={() => setForceExpandTrigger(Date.now())}
            type="button"
          >
            Expandir todos
          </button>
          {commentsUrl && (
            <>
              <span className="text-[var(--ep-rule)]">•</span>
              <a
                className="underline text-[var(--ep-muted)] hover:text-[var(--ep-ink)]"
                href={commentsUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Abrir en Hacker News ↗
              </a>
            </>
          )}
        </div>
      </div>

      <div className="comments-tree flex flex-col gap-3">
        {comments.map((comment) => (
          <CommentNode
            comment={comment}
            forceCollapseAll={forceCollapseTrigger}
            forceExpandAll={forceExpandTrigger}
            key={comment.id}
          />
        ))}
      </div>
    </section>
  )
}
