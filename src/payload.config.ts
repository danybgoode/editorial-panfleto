import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Articles } from './collections/Articles'
import { Authors } from './collections/Authors'
import { Issues } from './collections/Issues'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Sections } from './collections/Sections'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const explicitBlobTokenEnv = process.env.BLOB_READ_WRITE_TOKEN_ENV
const prefixedBlobTokens = Object.entries(process.env).filter(([key, value]) => {
  return (
    key !== 'BLOB_READ_WRITE_TOKEN' &&
    key.endsWith('_READ_WRITE_TOKEN') &&
    value?.startsWith('vercel_blob_rw_')
  )
})

const resolvedBlobTokenEnv =
  explicitBlobTokenEnv ||
  (prefixedBlobTokens.length === 1 ? prefixedBlobTokens[0][0] : 'BLOB_READ_WRITE_TOKEN')
const blobToken = process.env[resolvedBlobTokenEnv] || process.env.BLOB_READ_WRITE_TOKEN
const hasBlobToken = Boolean(blobToken)

if (process.env.VERCEL && !hasBlobToken) {
  throw new Error(
    'Persistent media storage is not configured. Add a Vercel Blob store to this project, verify BLOB_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN_ENV is present in the Vercel environment, then redeploy.',
  )
}

if (process.env.VERCEL && explicitBlobTokenEnv && !process.env[explicitBlobTokenEnv]) {
  throw new Error(
    `Persistent media storage is misconfigured. BLOB_READ_WRITE_TOKEN_ENV points to ${explicitBlobTokenEnv}, but that environment variable is empty.`,
  )
}

if (process.env.VERCEL && !explicitBlobTokenEnv && !process.env.BLOB_READ_WRITE_TOKEN && prefixedBlobTokens.length > 1) {
  throw new Error(
    `Persistent media storage is ambiguous. Found multiple prefixed Vercel Blob tokens (${prefixedBlobTokens
      .map(([key]) => key)
      .join(', ')}). Set BLOB_READ_WRITE_TOKEN_ENV to the token variable for the Blob store connected to this project.`,
  )
}

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
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
  collections: [Users, Media, Articles, Authors, Sections, Tags, Issues, Pages],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    vercelBlobStorage({
      clientUploads: true,
      collections: {
        media: true,
      },
      enabled: hasBlobToken,
      token: blobToken,
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
