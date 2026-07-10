import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getSectionsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : '') ||
      'https://example.com'

    const results = await payload.find({
      collection: 'sections',
      overrideAccess: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      sort: 'displayOrder',
      where: {
        isActive: {
          equals: true,
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((section) => Boolean(section?.slug))
          .map((section) => ({
            loc: `${SITE_URL}/sections/${section?.slug}`,
            lastmod: section.updatedAt || dateFallback,
          }))
      : []

    return sitemap
  },
  ['sections-sitemap'],
  {
    tags: ['sections-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getSectionsSitemap()

  return getServerSideSitemap(sitemap)
}
