'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { identifyReader } from '@/lib/personalized/reader'
import { getUsableSessionSecret, isPersonalizedEditionEnabled } from '@/lib/personalized/resolver'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sealSession } from '@/lib/personalized/session'

export async function connectReader(formData: FormData) {
  if (!isPersonalizedEditionEnabled()) redirect('/')

  const secret = getUsableSessionSecret()
  if (!secret) {
    console.error('[tu-edicion] EDITORIAL_SESSION_SECRET is missing or too short')
    redirect('/tu-edicion/conectar?error=config')
  }

  const token = String(formData.get('token') || '').trim()
  const identity = await identifyReader(token)

  if (identity.kind === 'malformed') redirect('/tu-edicion/conectar?error=formato')
  if (identity.kind === 'unauthorized') redirect('/tu-edicion/conectar?error=token')
  if (identity.kind === 'unavailable') redirect('/tu-edicion/conectar?error=caido')

  const cookieStore = await cookies()
  cookieStore.set(
    SESSION_COOKIE,
    sealSession(
      { issuedAt: Date.now(), key: token, userId: identity.userId, username: identity.username },
      secret,
    ),
    {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  )

  redirect('/tu-edicion')
}

export async function disconnectReader() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)

  redirect('/')
}
