# Editorial Panfleto

Payload CMS and Next.js for a reader-facing digital newspaper. Payload owns authentication, access control, migrations, editorial workflow, REST/GraphQL APIs, and the integrated admin UI.

## Required Software

- Node.js 22.x
- pnpm 11.x
- PostgreSQL, managed in production with Supabase
- Vercel Blob for production media storage

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
- `PREVIEW_SECRET`: secret for draft preview routes.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token. Required on Vercel.

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

Local development can fall back to local media storage when no Blob token is present. Vercel production must use object storage because serverless filesystem uploads are not persistent between deployments or function instances.

The Payload Vercel Blob adapter is configured for the `media` collection with client uploads enabled. Client uploads send files directly to Blob and avoid Vercel's server request-body upload limit. When the adapter is enabled, it disables permanent local storage for the media collection.

Vercel Blob setup:

1. Open the Vercel project.
2. Go to **Storage** and add a Blob store.
3. Connect the Blob store to this project.
4. Confirm `BLOB_READ_WRITE_TOKEN` exists in Production, Preview, and Development environments as needed.
5. Redeploy after adding or changing environment variables.

The Media collection accepts newsroom image formats, requires alt text, supports caption, credit, photographer/source, focal point selection, an admin thumbnail, and responsive sizes suitable for thumbnail, card, tablet, desktop, and social/share use. Original uploads are retained.

Supabase Storage is not configured. If there is a future reason to move away from Vercel Blob, Supabase Storage can be wired through Payload's official S3-compatible storage adapter. Do not configure both storage adapters at the same time.

## Content Model

Collections:

- Users
- Media
- Articles
- Authors
- Sections
- Tags
- Issues
- Pages

Articles support drafts, versions, autosave, Lexical rich text, featured images, galleries, author/co-author relationships, sections, tags, article type, editorial status, SEO fields, print notes, optional issue relationship, breaking-news flags, featured-story flags, and related articles.

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

Public cards use Payload image derivatives where available instead of always requesting originals. `next/image` is configured for local Payload media routes and Vercel Blob public URLs.

Article and page updates use the existing Payload revalidation hooks. Article metadata preserves SEO plugin fields, canonical URLs, Open Graph images, and social descriptions. Published article pages emit JSON-LD when the content model supplies the relevant fields.

## APIs

Payload REST API is available under `/api`. GraphQL and GraphQL Playground are enabled at `/api/graphql` and `/api/graphql-playground`.

Server-side application code should use Payload's Local API via `getPayload({ config })`.

## Vercel Deployment Checklist

- Set Node.js to 22.x or let Vercel use `package.json` engines.
- Set install command to `pnpm install --frozen-lockfile`.
- Ensure build command runs `pnpm payload migrate && pnpm build` as configured in `vercel.json`.
- Add `DATABASE_URL`.
- Add `PAYLOAD_SECRET`.
- Add `NEXT_PUBLIC_SERVER_URL`.
- Add `CRON_SECRET`.
- Add `PREVIEW_SECRET`.
- Add Vercel Blob and confirm `BLOB_READ_WRITE_TOKEN` exists.
- Redeploy after environment variable changes.
- Confirm production database migrations run successfully.

## Known Limitations

- Vercel project access is not available through the CLI in this environment, so Blob provisioning and deployment status must be verified in Vercel.
- Local validation requires a reachable PostgreSQL database.
- RSS is not implemented.
