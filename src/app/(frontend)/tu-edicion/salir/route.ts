import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE } from '@/lib/personalized/session'

// Reached when panfleto rejects the stored token (it was rotated or revoked). A server component can't
// clear a cookie, so the edition page sends the reader here, and this sends them to reconnect.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/tu-edicion/conectar?error=token', request.url), 303)
  response.cookies.delete(SESSION_COOKIE)

  return response
}
