import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug, Where } from 'payload'

import type { MinifluxMapping } from '../../payload-types'

import { htmlToLexicalRichText, sanitizeHTMLToText } from './html'
import { fetchMinifluxEntries, fetchMinifluxEntry, type MinifluxEntry } from './client'

type ImportResult = {
  articleId?: number | string
  created: number
  skipped: number
  updated: number
}

const getRelationshipId = (value: number | string | { id: number | string }) =>
  typeof value === 'object' ? value.id : value

const getExcerpt = (entry: MinifluxEntry): string => {
  const [firstParagraph] = sanitizeHTMLToText(entry.content)
  const base = firstParagraph || entry.title
  return base.length > 280 ? `${base.slice(0, 277).trim()}...` : base
}

const getArticleSlug = (headline: string, minifluxId: string): string => {
  const slug = headline
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `${slug || 'miniflux-entry'}-${minifluxId}`
}

const findArticleByMinifluxId = async (payload: Payload, minifluxId: string) =>
  payload.find({
    collection: 'articles',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      'meta.minifluxId': {
        equals: minifluxId,
      },
    } satisfies Where,
  })

const importEntry = async ({
  author,
  entry,
  payload,
  req,
  section,
}: {
  author: number | string
  entry: MinifluxEntry
  payload: Payload
  req?: PayloadRequest
  section: number | string
}): Promise<ImportResult> => {
  const minifluxId = String(entry.id)
  const existing = await findArticleByMinifluxId(payload, minifluxId)
  const publishedAt = entry.published_at || entry.created_at || new Date().toISOString()
  const headline = entry.title || 'Untitled Miniflux entry'

  if (existing.docs[0]) {
    await payload.update({
      id: existing.docs[0].id,
      collection: 'articles',
      data: {
        meta: {
          ...existing.docs[0].meta,
          canonicalURL: entry.url,
          minifluxId,
          minifluxImportedAt: new Date().toISOString(),
          minifluxSourceTitle: entry.feed?.title || entry.category?.title,
        },
        publishedAt,
        summary: getExcerpt(entry),
      } as Partial<RequiredDataFromCollectionSlug<'articles'>>,
      depth: 0,
      draft: true,
      overrideAccess: false,
      req,
    })

    return { articleId: existing.docs[0].id, created: 0, skipped: 0, updated: 1 }
  }

  const article = await payload.create({
    collection: 'articles',
    data: {
      _status: 'draft',
      articleType: 'news',
      author,
      body: htmlToLexicalRichText(entry.content, entry.title),
      editorialStatus: 'draft',
      headline,
      meta: {
        canonicalURL: entry.url,
        minifluxId,
        minifluxImportedAt: new Date().toISOString(),
        minifluxSourceTitle: entry.feed?.title || entry.category?.title,
      },
      publishedAt,
      section,
      slug: getArticleSlug(headline, minifluxId),
      summary: getExcerpt(entry),
    } as RequiredDataFromCollectionSlug<'articles'>,
    depth: 0,
    draft: true,
    overrideAccess: false,
    req,
  })

  return { articleId: article.id, created: 1, skipped: 0, updated: 0 }
}

export const syncMinifluxMapping = async ({
  mappingId,
  payload,
  req,
}: {
  mappingId: number | string
  payload: Payload
  req: PayloadRequest
}) => {
  const mapping = (await payload.findByID({
    id: mappingId,
    collection: 'miniflux-mappings',
    depth: 1,
    overrideAccess: false,
    req,
  })) as MinifluxMapping

  if (!mapping.active) {
    throw new Error('This Miniflux mapping is disabled.')
  }

  const entries = await fetchMinifluxEntries({
    limit: mapping.fetchLimit || 10,
    sourceType: mapping.sourceType,
    targetId: mapping.minifluxTargetId,
  })

  const section = getRelationshipId(mapping.section)
  const author = getRelationshipId(mapping.defaultAuthor)
  const totals: ImportResult = { created: 0, skipped: 0, updated: 0 }

  for (const entry of entries) {
    const result = await importEntry({ author, entry, payload, req, section })
    totals.created += result.created
    totals.skipped += result.skipped
    totals.updated += result.updated
  }

  await payload.update({
    id: mapping.id,
    collection: 'miniflux-mappings',
    data: {
      lastSyncAt: new Date().toISOString(),
      lastSyncCreated: totals.created,
      lastSyncUpdated: totals.updated,
      lastSyncSkipped: totals.skipped,
    },
    depth: 0,
    overrideAccess: false,
    req,
  })

  return {
    ...totals,
    fetched: entries.length,
    mappingTitle: mapping.title,
  }
}

export const importMinifluxEntry = async ({
  author,
  input,
  payload,
  req,
  section,
}: {
  author: number | string
  input: string
  payload: Payload
  req: PayloadRequest
  section: number | string
}) => {
  const entry = await fetchMinifluxEntry(input)
  const result = await importEntry({ author, entry, payload, req, section })

  return {
    ...result,
    title: entry.title,
  }
}
