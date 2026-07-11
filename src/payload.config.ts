import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Articles } from './collections/Articles'
import { Authors } from './collections/Authors'
import { Issues } from './collections/Issues'
import { Media } from './collections/Media'
import { MinifluxMappings } from './collections/MinifluxMappings'
import { Pages } from './collections/Pages'
import { Sections } from './collections/Sections'
import { Tags } from './collections/Tags'
import { Tasks } from './collections/Tasks'
import { Users } from './collections/Users'
import { minifluxEndpoints } from './endpoints/miniflux'
import { trendingEndpoints } from './endpoints/trending'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const mediaStorageProvider =
  process.env.MEDIA_STORAGE_PROVIDER || (process.env.S3_BUCKET ? 's3' : 'local')
const hasS3Config = Boolean(
  process.env.S3_BUCKET &&
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
)
const useS3Storage = mediaStorageProvider === 's3'

if (!['local', 's3'].includes(mediaStorageProvider)) {
  throw new Error(
    `Unsupported MEDIA_STORAGE_PROVIDER "${mediaStorageProvider}". Use "local" for development or "s3" for persistent object storage.`,
  )
}

if (process.env.VERCEL && !useS3Storage) {
  throw new Error(
    'Persistent media storage is not configured. Set MEDIA_STORAGE_PROVIDER=s3 and provide the S3/R2 environment variables before deploying to Vercel.',
  )
}

if (useS3Storage && !hasS3Config) {
  throw new Error(
    'Persistent media storage is incomplete. Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.',
  )
}

export default buildConfig({
  admin: {
    components: {
      graphics: {
        Icon: '@/components/AdminBranding#PanfletoAdminIcon',
        Logo: '@/components/AdminBranding#PanfletoAdminLogo',
      },
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      views: {
        dashboard: {
          Component: '@/components/EditorialDashboard',
          meta: {
            title: 'Workflow board',
          },
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      defaultOGImageType: 'off',
      icons: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          url: '/favicon.svg',
        },
        {
          rel: 'icon',
          sizes: '32x32',
          type: 'image/png',
          url: '/favicon-32x32.png',
        },
      ],
      openGraph: {
        siteName: 'Panfleto',
        title: 'Panfleto',
      },
      titleSuffix: '| Panfleto',
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  email: resendAdapter({
    defaultFromAddress: process.env.RESEND_FROM_ADDRESS || 'onboarding@resend.dev',
    defaultFromName: 'PANFLETO',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  collections: [Users, Media, Articles, Tasks, Authors, Sections, Tags, Issues, Pages, MinifluxMappings],
  cors: [getServerSideURL()].filter(Boolean),
  endpoints: [...minifluxEndpoints, ...trendingEndpoints],
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    s3Storage({
      clientUploads: true,
      collections: {
        media: {
          signedDownloads: true,
        },
      },
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        region: process.env.S3_REGION || 'auto',
      },
      bucket: process.env.S3_BUCKET || '',
      enabled: useS3Storage,
    }),
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
