import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'
import { siteName } from './editorial'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Periodismo, ensayo y cultura pública desde PANFLETO.',
  images: [
    {
      url: `${getServerSideURL()}/og-default.png`,
      width: 1200,
      height: 630,
      alt: 'PANFLETO',
    },
  ],
  siteName,
  title: siteName,
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
