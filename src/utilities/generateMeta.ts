import type { Metadata } from 'next'

import type { Media, Page, Article, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'
import { siteName } from './editorial'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/og-default.png'

  if (image && typeof image === 'object' && 'url' in image) {
    const ogSize = image.sizes?.og
    const imageUrl =
      process.env.NEXT_PUBLIC_MEDIA_DELIVERY === 'payload' && (ogSize?.filename || image.filename)
        ? `/api/media/file/${encodeURIComponent(ogSize?.filename || image.filename || '')}`
        : ogSize?.url || image.url

    if (imageUrl?.startsWith('http://') || imageUrl?.startsWith('https://')) {
      url = imageUrl
    } else if (imageUrl) {
      url = serverUrl + imageUrl
    }
  }

  return url
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Article> | null
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  const fallbackTitle = doc && 'headline' in doc ? doc.headline : doc && 'title' in doc ? doc.title : null
  const title = `${doc?.meta?.title || fallbackTitle || siteName} | ${siteName}`
  const path = doc?.slug
    ? 'headline' in doc
      ? `/articles/${doc.slug}`
      : doc.slug === 'home'
        ? '/'
        : `/${doc.slug}`
    : '/'
  const canonical =
    doc?.meta && 'canonicalURL' in doc.meta && typeof doc.meta.canonicalURL === 'string'
      ? doc.meta.canonicalURL
      : undefined
  const metaURL = canonical || path

  return {
    alternates: {
      canonical: metaURL,
    },
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: metaURL,
    }),
    title,
  }
}
