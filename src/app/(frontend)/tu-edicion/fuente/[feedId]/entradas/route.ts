import { NextResponse, type NextRequest } from 'next/server'

import { fetchReaderFeedEntries } from '@/lib/personalized/feeds'
import { isUnauthorizedError } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'

export const dynamic = 'force-dynamic'

// One page of a source's entries older than `antes` (an entry ID), for the source page's endless list.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ feedId: string }> },
) {
  const reader = resolvePersonalizedReader(request.cookies.get(SESSION_COOKIE)?.value)
  if (!reader) return NextResponse.json({ error: 'no-reader' }, { status: 401 })

  const feedId = Number((await params).feedId)
  const before = Number(request.nextUrl.searchParams.get('antes'))
  if (!Number.isInteger(feedId) || feedId <= 0 || !Number.isInteger(before) || before <= 0) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }

  try {
    const page = await fetchReaderFeedEntries(reader.key, feedId, {
      beforeEntryId: before,
      unreadOnly: request.nextUrl.searchParams.get('estado') === 'sin-leer',
    })
    return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: 'rejected' }, { status: 401 })
    console.error('[tu-edicion] could not load a source page', { feedId, message: String(error) })
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
