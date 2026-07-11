import type { DashboardViewServerProps } from '@payloadcms/next/views'
import type { Where } from 'payload'

import Link from 'next/link'
import React from 'react'

import { MinifluxAdHocImport } from '@/components/MinifluxAdHocImport'
import type { Article, Author, Section, Task, User } from '@/payload-types'
import { isAdminOrEditor } from '@/access/roles'

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

const taskColumns = [
  {
    label: 'To do',
    slug: 'todo',
    statuses: ['todo'],
  },
  {
    label: 'In progress',
    slug: 'in-progress',
    statuses: ['in_progress'],
  },
  {
    label: 'Under review',
    slug: 'under-review',
    statuses: ['under_review'],
  },
  {
    label: 'Completed',
    slug: 'completed',
    statuses: ['completed'],
  },
] as const

const taskStatusLabels: Record<Task['status'], string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  todo: 'To do',
  under_review: 'Under review',
}

const hasName = (value: unknown): value is Pick<Author | Section, 'name'> =>
  Boolean(value && typeof value === 'object' && 'name' in value && value.name)

const hasUserLabel = (value: unknown): value is Pick<User, 'email' | 'name'> =>
  Boolean(value && typeof value === 'object' && ('name' in value || 'email' in value))

const hasArticleHeadline = (value: unknown): value is Pick<Article, 'headline'> =>
  Boolean(value && typeof value === 'object' && 'headline' in value && value.headline)

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

const formatDeadline = (deadline: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(deadline))

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

const getVisibleTasksWhere = (user?: User | null): Where => {
  if (user?.role === 'writer') {
    return {
      assignedTo: {
        equals: user.id,
      },
    }
  }

  return {}
}

const getColumnArticles = (
  articles: Article[],
  statuses: readonly Article['editorialStatus'][],
) => articles.filter((article) => statuses.includes(article.editorialStatus)).slice(0, 12)

const getColumnTasks = (tasks: Task[], statuses: readonly Task['status'][]) =>
  tasks.filter((task) => statuses.includes(task.status)).slice(0, 12)

const assigneeFor = (task: Task) => {
  if (hasUserLabel(task.assignedTo)) return task.assignedTo.name || task.assignedTo.email

  return 'Unassigned'
}

const linkedArticleFor = (task: Task) =>
  hasArticleHeadline(task.article) ? task.article.headline : 'No article linked'

const EditorialDashboard = async ({ initPageResult, payload, user }: DashboardViewServerProps) => {
  const { req } = initPageResult

  const [articlesResult, tasksResult] = await Promise.all([
    payload.find({
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
    }),
    payload.find({
      collection: 'tasks',
      depth: 1,
      limit: 100,
      overrideAccess: false,
      pagination: false,
      req,
      select: {
        article: true,
        assignedTo: true,
        deadline: true,
        status: true,
        title: true,
      },
      sort: 'deadline',
      where: getVisibleTasksWhere(user),
    }),
  ])

  const articles = articlesResult.docs as Article[]
  const tasks = tasksResult.docs as Task[]
  const totalActive = articles.length
  const activeTasks = tasks.filter((task) => task.status !== 'completed').length
  const visibleName = user?.name || user?.email || 'editor'
  const canManageTasks = isAdminOrEditor(user)

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
        <div className="editorial-dashboard__actions">
          {canManageTasks && (
            <Link className="editorial-dashboard__create" href="/admin/collections/tasks/create">
              Create Task
            </Link>
          )}
          <Link className="editorial-dashboard__create" href="/admin/collections/articles/create">
            Create Article
          </Link>
        </div>
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
        <div className="editorial-dashboard__metric">
          <span>{activeTasks}</span>
          <p>Open tasks</p>
        </div>
      </section>

      <section className="editorial-dashboard__section-heading">
        <h2>Assignments</h2>
      </section>

      <section className="editorial-dashboard__task-board" aria-label="Assignment workflow">
        {taskColumns.map((column) => {
          const columnTasks = getColumnTasks(tasks, column.statuses)

          return (
            <div className="editorial-dashboard__column" key={column.slug}>
              <div className="editorial-dashboard__column-header">
                <h2>{column.label}</h2>
                <span>{columnTasks.length}</span>
              </div>

              <div className="editorial-dashboard__stack">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => (
                    <Link
                      className="editorial-dashboard__card editorial-dashboard__task-card"
                      href={`/admin/collections/tasks/${task.id}`}
                      key={task.id}
                    >
                      <span className="editorial-dashboard__status">
                        {taskStatusLabels[task.status]}
                      </span>
                      <h3>{task.title}</h3>
                      <dl>
                        <div>
                          <dt>Deadline</dt>
                          <dd>{formatDeadline(task.deadline)}</dd>
                        </div>
                        <div>
                          <dt>Assignee</dt>
                          <dd>{assigneeFor(task)}</dd>
                        </div>
                        <div>
                          <dt>Article</dt>
                          <dd>{linkedArticleFor(task)}</dd>
                        </div>
                      </dl>
                    </Link>
                  ))
                ) : (
                  <div className="editorial-dashboard__empty">No tasks here.</div>
                )}
              </div>
            </div>
          )
        })}
      </section>

      <section className="editorial-dashboard__import">
        <MinifluxAdHocImport />
      </section>

      <section className="editorial-dashboard__section-heading">
        <h2>Articles</h2>
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
