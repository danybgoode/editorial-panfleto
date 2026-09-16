import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'

import { resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'
import { formatEditorialDate } from '@/utilities/editorial'

import { disconnectReader } from './actions'

export const dynamic = 'force-dynamic'

export default async function PersonalizedEditionPage() {
  const reader = resolvePersonalizedReader((await cookies()).get(SESSION_COOKIE)?.value)
  if (!reader) redirect('/')

  return (
    <div className="newspaper-home">
      <section className="front-context ep-container" aria-label="Tu edición">
        <p>{formatEditorialDate(new Date().toISOString(), { weekday: 'long' })}</p>
        <h1>Tu edición</h1>
        <form action={disconnectReader}>
          <p>
            Conectado como <strong>{reader.username}</strong> ·{' '}
            <button className="underline" type="submit">
              Salir
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Tu edición',
}
