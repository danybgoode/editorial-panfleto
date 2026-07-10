import type { Article, Author, Media, Section } from '@/payload-types'
import { getServerSideURL } from './getURL'

export const siteName = 'Editorial Panfleto'

export const articleTypes: Record<Article['articleType'], string> = {
  editorial: 'Editorial',
  feature: 'Crónica',
  interview: 'Entrevista',
  investigation: 'Investigación',
  news: 'Noticias',
  opinion: 'Opinión',
  review: 'Reseña',
}

export const formatEditorialDate = (date?: null | string, options?: Intl.DateTimeFormatOptions) => {
  if (!date) return ''

  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    ...options,
  }).format(new Date(date))
}

export const formatEditorialDateTime = (date?: null | string) => {
  if (!date) return ''

  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    timeZone: 'America/Mexico_City',
    year: 'numeric',
  }).format(new Date(date))
}

export const getArticleHref = (article: Pick<Article, 'slug'>) => `/articles/${article.slug}`

export const getSectionHref = (section: Pick<Section, 'slug'>) => `/sections/${section.slug}`

export const getSectionName = (section?: Article['section'] | null) =>
  section && typeof section === 'object' ? section.name : ''

export const getAuthorName = (author?: Article['author'] | Author | number | null) =>
  author && typeof author === 'object' ? author.name : ''

export const getArticleAuthors = (article: Pick<Article, 'author' | 'coAuthors' | 'populatedAuthors'>) => {
  const populated =
    article.populatedAuthors
      ?.map((author) => author.name)
      .filter((name): name is string => Boolean(name)) || []
  const primary = getAuthorName(article.author)
  const coAuthors =
    article.coAuthors
      ?.map((author) => (typeof author === 'object' ? author.name : ''))
      .filter((name): name is string => Boolean(name)) || []

  const names = (populated.length > 0 ? populated : [primary, ...coAuthors]).filter(
    (name): name is string => Boolean(name),
  )

  return new Intl.ListFormat('es-MX', { style: 'long', type: 'conjunction' }).format(names)
}

export const getMediaCaption = (media?: Media | number | null) => {
  if (!media || typeof media !== 'object') return ''

  const credits = [media.photographer, media.source || media.credit].filter(Boolean)
  return credits.length ? credits.join(' / ') : ''
}

export const getAbsoluteMediaURL = (media?: Media | number | null, size: keyof NonNullable<Media['sizes']> = 'og') => {
  if (!media || typeof media !== 'object') return ''

  const selectedSize = media.sizes?.[size]
  const filename = selectedSize?.filename || media.filename
  const url =
    process.env.NEXT_PUBLIC_MEDIA_DELIVERY === 'payload' && filename
      ? `/api/media/file/${encodeURIComponent(filename)}`
      : selectedSize?.url || media.url

  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  return `${getServerSideURL()}${url}`
}

export const estimateReadingTime = (body: Article['body']) => {
  const text = JSON.stringify(body)
    .replace(/"text":"([^"]+)"/g, '$1 ')
    .replace(/[{}\[\]",:]/g, ' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length

  return Math.max(1, Math.ceil(words / 220))
}
