import { NextResponse, type NextRequest } from 'next/server'

import { fetchReaderDay } from '@/lib/personalized/feeds'
import { isUnauthorizedError } from '@/lib/personalized/reader'
import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'

export const dynamic = 'force-dynamic'

const MAX_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000

// "Antes de hoy": the newest day of the reader's entries published before `antes` (ms since epoch).
export async function GET(request: NextRequest) {
  const reader = resolvePersonalizedReader(request.cookies.get(SESSION_COOKIE)?.value)
  if (!reader) return NextResponse.json({ error: 'no-reader' }, { status: 401 })

  const now = Date.now()
  const before = Number(request.nextUrl.searchParams.get('antes'))
  if (!Number.isFinite(before) || before > now || before < now - MAX_LOOKBACK_MS) {
    return NextResponse.json({ error: 'bad-cursor' }, { status: 400 })
  }

  try {
    const page = await fetchReaderDay(reader.key, { before, now })
    return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: 'rejected' }, { status: 401 })
    console.error('[tu-edicion] could not load an earlier day', { message: String(error) })
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
