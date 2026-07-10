# Editorial Panfleto

Payload CMS and Next.js starter for a headless digital newspaper. It is based on the official stable Payload website template, adapted for article publishing, editorial roles, PostgreSQL, and Vercel-compatible media storage.

## Required Software

- Node.js 22.x
- pnpm 11.x
- PostgreSQL
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

- `DATABASE_URL`: PostgreSQL connection string.
- `PAYLOAD_SECRET`: long random secret for Payload auth.
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

Articles support drafts, versions, autosave, Lexical rich text, featured images, galleries, author/co-author relationships, sections, tags, article type, editorial status, SEO fields, print notes, optional issue relationship, and related articles.

## Roles

- `admin`: full access, including users, roles, publishing, deletion, media, authors, sections, tags, pages, and issues.
- `editor`: admin panel access; can create/edit articles, publish/unpublish, and manage media, authors, sections, and tags. Editors cannot manage users or promote accounts to admin.
- `writer`: admin panel access; can create articles, edit owned articles, and save draft/review work. Writers cannot publish, manage users, change roles, or edit other writers' articles.

The first created user is promoted to `admin`. At least one admin account must remain.

## APIs

Payload REST API is available under `/api`. GraphQL and GraphQL Playground are enabled at `/api/graphql` and `/api/graphql-playground`.

Public unauthenticated article reads are limited to documents where both Payload `_status` and `editorialStatus` are `published`.

Example REST fetch:

```ts
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SERVER_URL}/api/articles?where[_status][equals]=published&where[editorialStatus][equals]=published`,
)

const articles = await response.json()
```

Server-side application code can use Payload's Local API via `getPayload({ config })`, as the starter frontend already does.

## Media Storage

Local development can use local media storage. Vercel production must use Vercel Blob by setting `BLOB_READ_WRITE_TOKEN`; Vercel functions are stateless and must not be used for persistent uploads.

The Payload Vercel Blob adapter is configured for the `media` collection and disables local storage when the token is present.

## PostgreSQL

Create a local database matching `DATABASE_URL`, then run:

```bash
pnpm payload migrate
```

For production, provision a managed PostgreSQL database and set `DATABASE_URL` in Vercel before deploying.

## Vercel Deployment Checklist

- Set Node.js to 22.x or let Vercel use `package.json` engines.
- Set install command to `pnpm install --frozen-lockfile`.
- Ensure build command runs `pnpm payload migrate && pnpm build` (included in `vercel.json`).
- Add `DATABASE_URL`.
- Add `PAYLOAD_SECRET`.
- Add `NEXT_PUBLIC_SERVER_URL`.
- Add `CRON_SECRET`.
- Add `PREVIEW_SECRET`.
- Add Vercel Blob and confirm `BLOB_READ_WRITE_TOKEN` exists.
- Confirm production database migrations run successfully.

## First Admin User

After migrations and `pnpm dev`, visit `/admin` and create the first user. The first account is automatically assigned the `admin` role.

## Known Limitations

- The frontend is still the stable Payload website starter layout with article routes, not a final newspaper design.
- Production builds query PostgreSQL during page generation, so migrations and database connectivity must be available before `pnpm build`.
- Vercel functions are stateless; persistent content must live in PostgreSQL and uploaded media must live in object storage such as Vercel Blob.
- Local validation requires a reachable PostgreSQL database.
