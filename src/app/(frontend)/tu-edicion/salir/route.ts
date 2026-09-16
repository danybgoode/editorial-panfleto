import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE } from '@/lib/personalized/session'

// Reached when panfleto rejects the stored token (it was rotated or revoked). A server component can't
// clear a cookie, so the edition page sends the reader here, and this sends them to reconnect.
export function GET(request: NextRequest) {
  // Only our own redirect may sign a reader out: a cross-site link or <img> can't.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.redirect(new URL('/', request.url), 303)
  }

  const response = NextResponse.redirect(
    new URL('/tu-edicion/conectar?error=token', request.url),
    303,
  )
  response.cookies.delete(SESSION_COOKIE)

  return response
}
