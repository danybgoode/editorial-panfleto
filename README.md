# PANFLETO

Payload CMS and Next.js for a reader-facing digital newspaper. Payload owns authentication, access control, migrations, editorial workflow, REST/GraphQL APIs, and the integrated admin UI.

## Required Software

- Node.js 22.x
- pnpm 11.x
- PostgreSQL, managed in production with Supabase
- Cloudflare R2, configured through Payload's S3 storage adapter, for production media storage

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm payload migrate
pnpm dev
```

Payload admin runs at `http://localhost:3000/admin`.

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string used by `@payloadcms/db-postgres`.
- `PAYLOAD_SECRET`: long random secret for Payload auth and encrypted values.
- `NEXT_PUBLIC_SERVER_URL`: public app URL, no trailing slash.
- `CRON_SECRET`: secret for scheduled jobs.
- `QSTASH_TOKEN` or `UPSTASH_QSTASH_TOKEN`: Upstash QStash publish token for fan-out Miniflux sync jobs.
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST endpoint for article view tracking.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token with write access for article view tracking.
- `PREVIEW_SECRET`: secret for draft preview routes.
- `MEDIA_STORAGE_PROVIDER`: `s3` in Vercel, or `local` for local development without object storage.
- `NEXT_PUBLIC_MEDIA_DELIVERY`: use `payload` to render files through Payload's media route, or `direct` for public object-store URLs.
- `S3_BUCKET`: R2 bucket name.
- `S3_ENDPOINT`: R2 S3 API endpoint, for example `https://ACCOUNT_ID.r2.cloudflarestorage.com`.
- `S3_REGION`: use `auto` for Cloudflare R2.
- `S3_FORCE_PATH_STYLE`: use `true` for Cloudflare R2.
- `S3_ACCESS_KEY_ID`: R2 S3 access key ID.
- `S3_SECRET_ACCESS_KEY`: R2 S3 secret access key.
- `RESEND_API_KEY`: Resend API key used by Payload transactional email.
- `RESEND_FROM_ADDRESS`: verified sender address for workspace invitations and assignment notices.

Never commit `.env` or production secrets.

## pnpm Commands

- `pnpm dev`: start local development.
- `pnpm build`: production Next.js build.
- `pnpm lint`: run ESLint.
- `pnpm typecheck`: run TypeScript checks.
- `pnpm generate:types`: regenerate `src/payload-types.ts`.
- `pnpm generate:importmap`: regenerate the Payload admin import map.
- `pnpm payload migrate:create <name>`: create a PostgreSQL migration.
- `pnpm payload migrate`: apply migrations.
- `pnpm payload migrate:status`: inspect migration status.

## Supabase PostgreSQL

Use Supabase only as the managed PostgreSQL provider. Do not add Supabase Auth, query Payload tables from the browser, enable RLS across Payload-owned tables, or create tables manually for normal Payload schema changes.

Setup:

1. Create a Supabase project.
2. In Supabase, click **Connect** and copy the Session pooler connection string on port `5432`.
3. URL-encode the database password before placing it in the URL.
4. Set `DATABASE_URL` locally and in Vercel.
5. Run Payload migrations with `pnpm payload migrate`.

The expected shape is:

```text
postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=verify-full
```

Supabase examples often show `sslmode=require`. With the installed `pg`/`pg-connection-string` stack, Vercel can warn that `require` currently behaves like `verify-full`; using `sslmode=verify-full` keeps the current behavior explicit and removes that warning. If you intentionally want libpq-compatible `require` semantics, use `uselibpqcompat=true&sslmode=require` instead.

## Media Storage

Local development can fall back to local media storage by setting `MEDIA_STORAGE_PROVIDER=local`. Vercel production must use object storage because serverless filesystem uploads are not persistent between deployments or function instances.

Production media is configured with Payload's official `@payloadcms/storage-s3` adapter against Cloudflare R2. The adapter targets the `media` collection, enables client uploads, and disables local permanent storage when enabled. Client uploads send files directly to R2 using presigned URLs, avoiding Vercel's server request-body upload limit.

R2 setup:

1. Create or open the Cloudflare R2 bucket.
2. Create R2 S3 client credentials for this bucket.
3. Set `MEDIA_STORAGE_PROVIDER=s3`.
4. Set `NEXT_PUBLIC_MEDIA_DELIVERY=payload` unless the bucket has a public custom delivery domain.
5. Set `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=true`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` locally and in Vercel Production/Preview/Development as appropriate.
6. Configure bucket CORS to allow browser uploads from the production domain and local development:

```json
[
  {
    "AllowedOrigins": ["https://editorial-panfleto.vercel.app", "https://*.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Redeploy after adding or changing environment variables.

The previous Vercel Blob proof-of-concept was removed after client uploads repeatedly received a stale or wrong Vercel Blob handoff URL (`PUT https://vercel.com/api/blob/?pathname=...`), causing browser CORS failures and eventual expired-token errors. R2 is the intended long-term storage provider for this project.

The Media collection accepts newsroom image formats, requires alt text, supports caption, credit, photographer/source, focal point selection, an admin thumbnail, and responsive sizes suitable for thumbnail, card, tablet, desktop, and social/share use. Original uploads are retained.

Vercel Blob and Supabase Storage are not configured. Supabase Storage could be used later through the same Payload S3-compatible storage path, but do not configure multiple storage adapters at the same time.

## Content Model

Collections:

- Users
- Media
- Articles
- Tasks
- Authors
- Sections
- Tags
- Issues
- Pages

Articles support drafts, versions, autosave, Lexical rich text, featured images, galleries, author/co-author relationships, sections, tags, article type, editorial status, SEO fields, print notes, optional issue relationship, breaking-news flags, featured-story flags, and related articles.

Tasks support assignment title, rich-text requirements, deadline, lifecycle status, writer/editor assignee, optional linked article, dashboard status lists, assignment notifications, and writer-scoped access.

## Roles

- `admin`: full access, including users, roles, publishing, deletion, media, authors, sections, tags, pages, and issues.
- `editor`: admin panel access; can create/edit articles, publish/unpublish, and manage media, authors, sections, and tags. Editors cannot manage users or promote accounts to admin.
- `writer`: admin panel access; can create articles, edit owned articles, and save draft/review work. Writers cannot publish, manage users, change roles, or edit other writers' articles.

The first created user is promoted to `admin`. At least one admin account must remain.

## Public Frontend

The public site is a Payload-driven newspaper experience:

- `/`: front page using featured articles first, then latest reporting, breaking-news items, opinion/editorial stories, feature/investigation treatment, and modules for active sections.
- `/articles`: paginated archive using Payload server-side pagination.
- `/articles/[slug]`: long-form article page with section label, article type, headline, deck, byline, timestamps, reading time, accessible share links, hero image captions/credits, Lexical body rendering, related stories, metadata, and article JSON-LD.
- `/sections/[slug]`: section listing with active section metadata, a lead story, server-side Payload pagination via `?page=`.
- `/search`: modest server-side search against published articles.

Public pages use Payload Local API on the server. Unauthenticated article reads remain constrained by the existing collection access rules: both Payload `_status` and `editorialStatus` must be `published`.

## Styling Architecture

The public design uses the existing CSS/Tailwind setup in `src/app/(frontend)/globals.css`. Design tokens define paper background, ink, muted text, rules, editorial accent, content widths, typography, and responsive behavior. The admin interface is not visually restyled to match the public site.

## Images, Cache, And SEO

Public cards use Payload image derivatives where available instead of always requesting originals. With `NEXT_PUBLIC_MEDIA_DELIVERY=payload`, `next/image` renders through `/api/media/file/...`, allowing the R2 bucket to remain private while Payload signs object reads.

Article and page updates use the existing Payload revalidation hooks. Article metadata preserves SEO plugin fields, canonical URLs, Open Graph images, and social descriptions. Published article pages emit JSON-LD when the content model supplies the relevant fields.

## APIs

Payload REST API is available under `/api`. GraphQL and GraphQL Playground are enabled at `/api/graphql` and `/api/graphql-playground`.

Server-side application code should use Payload's Local API via `getPayload({ config })`.

Miniflux automation uses `/api/miniflux/cron-trigger` as the authenticated dispatcher and `/api/miniflux/sync-feed` as the single-mapping worker. Both expect `Authorization: Bearer $CRON_SECRET`. Article pages post to `/api/trending/view` after mount; the endpoint increments `news:views:YYYY-MM-DD` in Upstash Redis and the homepage reads those ZSETs with a time-decay ranking.

## Vercel Deployment Checklist

- Set Node.js to 22.x or let Vercel use `package.json` engines.
- Set install command to `pnpm install --frozen-lockfile`.
- Ensure build command runs `pnpm payload migrate && pnpm build` as configured in `vercel.json`.
- Add `DATABASE_URL`.
- Add `PAYLOAD_SECRET`.
- Add `NEXT_PUBLIC_SERVER_URL`.
- Add `CRON_SECRET`.
- Add `QSTASH_TOKEN` or `UPSTASH_QSTASH_TOKEN`.
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Add `PREVIEW_SECRET`.
- Add the Cloudflare R2 / S3 environment variables listed above.
- Add `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` for transactional email.
- Confirm R2 CORS allows PUT requests from the production and preview domains.
- Redeploy after environment variable changes.
- Confirm production database migrations run successfully.

## Known Limitations

- Vercel project access is available only when a valid local Vercel token is provided. Do not commit that token.
- Local validation requires a reachable PostgreSQL database.
- RSS is not implemented.
