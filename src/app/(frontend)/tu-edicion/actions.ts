'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { forgetEdition } from '@/lib/personalized/edition'
import { identifyReader } from '@/lib/personalized/reader'
import {
  getUsableSessionSecret,
  isPersonalizedEditionEnabled,
  resolvePersonalizedReader,
} from '@/lib/personalized/resolver'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sealSession } from '@/lib/personalized/session'
import { getEditionStore } from '@/lib/personalized/store'

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
  const reader = resolvePersonalizedReader(cookieStore.get(SESSION_COOKIE)?.value)
  cookieStore.delete(SESSION_COOKIE)

  // The edition is derived and disposable; a reader who leaves shouldn't leave a copy of their day behind.
  if (reader) {
    await forgetEdition(getEditionStore(), reader.userId).catch(() => undefined)
  }

  redirect('/')
}
