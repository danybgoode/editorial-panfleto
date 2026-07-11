import type { DashboardViewServerProps } from '@payloadcms/next/views'
import type { Where } from 'payload'

import Link from 'next/link'
import React from 'react'

import { MinifluxAdHocImport } from '@/components/MinifluxAdHocImport'
import type { Article, Author, Section, User } from '@/payload-types'

import './index.scss'

const statusColumns = [
  {
    label: 'Drafts',
    slug: 'drafts',
    statuses: ['draft'],
  },
  {
    label: 'In Review',
    slug: 'review',
    statuses: ['in-review', 'ready'],
  },
  {
    label: 'Published',
    slug: 'published',
    statuses: ['published'],
  },
] as const

const statusLabels: Record<Article['editorialStatus'], string> = {
  archived: 'Archived',
  draft: 'Draft',
  'in-review': 'In review',
  published: 'Published',
  ready: 'Ready',
}

const hasName = (value: unknown): value is Pick<Author | Section, 'name'> =>
  Boolean(value && typeof value === 'object' && 'name' in value && value.name)

const bylineFor = (article: Article) => {
  const primary = hasName(article.author) ? article.author.name : null
  const coAuthors = Array.isArray(article.coAuthors)
    ? article.coAuthors
        .map((author) => (hasName(author) ? author.name : null))
        .filter(Boolean)
    : []

  return [primary, ...coAuthors].filter(Boolean).join(', ') || 'Unassigned'
}

const sectionFor = (article: Article) => (hasName(article.section) ? article.section.name : 'No section')

const formatUpdatedAt = (updatedAt: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(updatedAt))

const getEditableArticlesWhere = (user?: User | null): Where => {
  const activeStatusFilter: Where = {
    editorialStatus: {
      not_equals: 'archived',
    },
  }

  if (user?.role === 'writer') {
    return {
      and: [
        activeStatusFilter,
        {
          owner: {
            equals: user.id,
          },
        },
      ],
    }
  }

  return activeStatusFilter
}

const getColumnArticles = (
  articles: Article[],
  statuses: readonly Article['editorialStatus'][],
) => articles.filter((article) => statuses.includes(article.editorialStatus)).slice(0, 12)

const EditorialDashboard = async ({ initPageResult, payload, user }: DashboardViewServerProps) => {
  const { req } = initPageResult

  const articlesResult = await payload.find({
    collection: 'articles',
    depth: 1,
    limit: 75,
    overrideAccess: false,
    pagination: false,
    req,
    select: {
      author: true,
      coAuthors: true,
      editorialStatus: true,
      headline: true,
      section: true,
      updatedAt: true,
    },
    sort: '-updatedAt',
    where: getEditableArticlesWhere(user),
  })

  const articles = articlesResult.docs as Article[]
  const totalActive = articles.length
  const visibleName = user?.name || user?.email || 'editor'

  return (
    <main className="editorial-dashboard">
      <header className="editorial-dashboard__header">
        <div>
          <p className="editorial-dashboard__eyebrow">Panfleto editorial</p>
          <h1>Workflow board</h1>
          <p className="editorial-dashboard__lede">
            Recent editable articles for {visibleName}. Drafts, review queues, and published work
            stay in one scan-friendly view.
          </p>
        </div>
        <Link className="editorial-dashboard__create" href="/admin/collections/articles/create">
          Create New Article
        </Link>
      </header>

      <section className="editorial-dashboard__tools">
        <div className="editorial-dashboard__metric">
          <span>{totalActive}</span>
          <p>Active articles</p>
        </div>
        {statusColumns.map((column) => (
          <div className="editorial-dashboard__metric" key={column.slug}>
            <span>{getColumnArticles(articles, column.statuses).length}</span>
            <p>{column.label}</p>
          </div>
        ))}
      </section>

      <section className="editorial-dashboard__import">
        <MinifluxAdHocImport />
      </section>

      <section className="editorial-dashboard__board" aria-label="Editorial workflow">
        {statusColumns.map((column) => {
          const columnArticles = getColumnArticles(articles, column.statuses)

          return (
            <div className="editorial-dashboard__column" key={column.slug}>
              <div className="editorial-dashboard__column-header">
                <h2>{column.label}</h2>
                <span>{columnArticles.length}</span>
              </div>

              <div className="editorial-dashboard__stack">
                {columnArticles.length > 0 ? (
                  columnArticles.map((article) => (
                    <Link
                      className="editorial-dashboard__card"
                      href={`/admin/collections/articles/${article.id}`}
                      key={article.id}
                    >
                      <span className="editorial-dashboard__status">
                        {statusLabels[article.editorialStatus]}
                      </span>
                      <h3>{article.headline}</h3>
                      <dl>
                        <div>
                          <dt>Byline</dt>
                          <dd>{bylineFor(article)}</dd>
                        </div>
                        <div>
                          <dt>Section</dt>
                          <dd>{sectionFor(article)}</dd>
                        </div>
                        <div>
                          <dt>Last updated</dt>
                          <dd>{formatUpdatedAt(article.updatedAt)}</dd>
                        </div>
                      </dl>
                    </Link>
                  ))
                ) : (
                  <div className="editorial-dashboard__empty">No articles here.</div>
                )}
              </div>
            </div>
          )
        })}
      </section>
    </main>
  )
}

export default EditorialDashboard
