import { NextResponse, type NextRequest } from 'next/server'

import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'

// The front page's one fork (fluxonline personalized-edition D7). A connected reader asking for `/` is
// rewritten to their dynamic edition; everyone else gets the curated, statically cached front page untouched.
// The matcher only fires when the session cookie is present, so an anonymous request never runs this at all.
export function proxy(request: NextRequest) {
  if (!resolvePersonalizedReader(request.cookies.get(SESSION_COOKIE)?.value))
    return NextResponse.next()

  return NextResponse.rewrite(new URL('/tu-edicion', request.url))
}

export const config = {
  // Must stay a literal: Next reads this statically. It is SESSION_COOKIE.
  matcher: [{ has: [{ key: 'panfleto_edicion', type: 'cookie' }], source: '/' }],
}
