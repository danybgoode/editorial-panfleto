import { timingSafeEqual } from 'node:crypto'
import { getPayload, type Where } from 'payload'

import configPromise from '@payload-config'

// GET /next/tally/{summary|members|log}: the editorial team in tally (tally.goldenfrijoles.com, the owner's
// analytics app). Daniel asked for it on 2026-11-27 ("members lists have to be available in all projects").
// tally calls it server-side with `Authorization: Bearer $TALLY_CONNECTOR_KEY` and stores nothing. A missing,
// wrong or unset key is a plain 404. Read-only, through Payload's local API with overrideAccess (operator view).

export const dynamic = 'force-dynamic'

const notFound = () => new Response(null, { status: 404 })
const json = (body: unknown) =>
  Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
const int = (v: string | null, d: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.parseInt(v ?? '', 10) || d))

function authorized(request: Request): boolean {
  const secret = process.env.TALLY_CONNECTOR_KEY?.trim()
  const header = request.headers.get('authorization')
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length).trim())
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const MEMBER_SORT: Record<string, string> = {
  name: 'name',
  email: 'email',
  role: 'role',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
}

export async function GET(request: Request, { params }: { params: Promise<{ what: string }> }) {
  if (!authorized(request)) return notFound()
  const { what } = await params
  const url = new URL(request.url)
  const payload = await getPayload({ config: configPromise })
  const limit = int(url.searchParams.get('size'), 25, 5, 200)
  const page = int(url.searchParams.get('page'), 1, 1, 100000)
  const q = (url.searchParams.get('q') ?? '').trim()

  if (what === 'members') {
    const field = MEMBER_SORT[url.searchParams.get('sort') ?? ''] ?? 'createdAt'
    const where: Where | undefined = q
      ? { or: [{ name: { like: q } }, { email: { like: q } }] }
      : undefined
    const res = await payload.find({
      collection: 'users',
      overrideAccess: true,
      depth: 0,
      limit,
      page,
      where,
      sort: url.searchParams.get('dir') === 'asc' ? field : `-${field}`,
    })
    return json({
      total: res.totalDocs,
      rows: res.docs.map((u) => {
        const doc = u as unknown as Record<string, unknown>
        return {
          name: doc.name ?? '—',
          email: doc.email ?? '—',
          role: doc.role ?? '—',
          created_at: doc.createdAt,
          updated_at: doc.updatedAt,
        }
      }),
      columns: [
        { key: 'name', label: 'Name', sort: true },
        { key: 'email', label: 'Email', sort: true },
        { key: 'role', label: 'Role', sort: true },
        { key: 'created_at', label: 'Joined', type: 'date', sort: true },
        { key: 'updated_at', label: 'Updated', type: 'date', sort: true },
      ],
    })
  }

  if (what === 'summary') {
    const days = int(url.searchParams.get('days'), 30, 1, 400)
    const since = new Date(Date.now() - days * 864e5).toISOString()
    const count = async (collection: 'users' | 'articles' | 'authors' | 'issues', where?: Where) =>
      (await payload.count({ collection, overrideAccess: true, where })).totalDocs
    const statuses = ['draft', 'in-review', 'ready', 'published', 'archived'] as const
    const [users, admins, editors, writers, authors, issues, articles, newArticles, ...byStatus] =
      await Promise.all([
        count('users'),
        count('users', { role: { equals: 'admin' } }),
        count('users', { role: { equals: 'editor' } }),
        count('users', { role: { equals: 'writer' } }),
        count('authors'),
        count('issues'),
        count('articles'),
        count('articles', { createdAt: { greater_than_equal: since } }),
        ...statuses.map((s) => count('articles', { editorialStatus: { equals: s } })),
      ])
    const recent = await payload.find({
      collection: 'articles',
      overrideAccess: true,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: { createdAt: { greater_than_equal: since } },
      select: { createdAt: true },
    })
    const daily = new Map<string, number>()
    for (const a of recent.docs) {
      const d = String((a as unknown as { createdAt: string }).createdAt).slice(0, 10)
      daily.set(d, (daily.get(d) ?? 0) + 1)
    }
    const st = Object.fromEntries(statuses.map((s, i) => [s, byStatus[i]]))
    return json({
      tiles: [
        {
          label: 'Team',
          value: users,
          sub: `${admins} admins · ${editors} editors · ${writers} writers`,
        },
        { label: 'Articles', value: articles, sub: `+${newArticles} in range` },
        { label: 'Published', value: st.published, sub: `${st.ready} ready to publish` },
        { label: 'In review', value: st['in-review'], sub: `${st.draft} drafts` },
        { label: 'Authors', value: authors, sub: 'bylines' },
        { label: 'Issues', value: issues, sub: 'editions' },
      ],
      sections: [
        {
          title: 'Team',
          kind: 'kv',
          rows: [
            ['Members', users],
            ['Admins', admins],
            ['Editors', editors],
            ['Writers', writers],
          ],
        },
        {
          title: 'Articles by status',
          kind: 'kv',
          rows: [
            ['Draft', st.draft],
            ['In review', st['in-review']],
            ['Ready', st.ready],
            ['Published', st.published],
            ['Archived', st.archived],
          ],
        },
      ],
      daily: [...daily.entries()].sort().map(([d, n]) => ({ d, n })),
      daily_label: 'Articles started per day',
    })
  }

  if (what === 'log') {
    const res = await payload.find({
      collection: 'articles',
      overrideAccess: true,
      depth: 0,
      limit,
      page,
      sort: '-updatedAt',
      where: q ? { headline: { like: q } } : undefined,
      select: { headline: true, editorialStatus: true, updatedAt: true },
    })
    return json({
      total: res.totalDocs,
      rows: res.docs.map((a) => {
        const doc = a as unknown as Record<string, unknown>
        return { at: doc.updatedAt, name: doc.headline ?? '—', status: doc.editorialStatus ?? '—' }
      }),
      columns: [
        { key: 'at', label: 'Updated', type: 'date' },
        { key: 'name', label: 'Article' },
        { key: 'status', label: 'Status' },
      ],
    })
  }
  return notFound()
}
