import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isPersonalizedEditionEnabled, resolvePersonalizedReader } from '@/lib/personalized/resolver'
import { SESSION_COOKIE } from '@/lib/personalized/session'

import { connectReader } from '../actions'

export const dynamic = 'force-dynamic'

const PANFLETO_SETTINGS_URL = 'https://app.panfleto.win/integrations'

const errors: Record<string, string> = {
  caido:
    'panfleto no está respondiendo ahora mismo. Tu token no tiene nada malo: no lo cambies, inténtalo de nuevo en unos minutos.',
  config: 'La edición personal no está disponible en este momento.',
  formato: 'Eso no parece un token de panfleto. Cópialo completo desde Ajustes → Integraciones.',
  token:
    'panfleto no reconoce ese token. Puede que lo hayas cambiado: genera o copia el actual en Ajustes → Integraciones.',
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!isPersonalizedEditionEnabled()) notFound()

  const { error } = await searchParams
  const reader = resolvePersonalizedReader((await cookies()).get(SESSION_COOKIE)?.value)
  const message = error ? errors[error] : undefined

  return (
    <div className="ep-container">
      <section className="front-context">
        <p>Tu edición</p>
        <h1>Tus fuentes, como un periódico.</h1>
        <p>
          Conecta tu cuenta de panfleto y esta portada se arma con los medios que tú sigues: arriba lo
          que publicaron varios de ellos, no lo último que llegó.
        </p>
      </section>

      {reader ? (
        <section className="empty-state">
          <p>
            Ya estás conectado como <strong>{reader.username}</strong>.{' '}
            <Link href="/tu-edicion">Ir a tu edición</Link>
          </p>
        </section>
      ) : (
        <section className="empty-state grid max-w-xl gap-5">
          <ol className="grid list-decimal gap-2 pl-5">
            <li>
              Abre{' '}
              <a href={PANFLETO_SETTINGS_URL} rel="noopener noreferrer" target="_blank">
                panfleto → Ajustes → Integraciones
              </a>{' '}
              y genera tu token (o copia el que ya tienes).
            </li>
            <li>Pégalo aquí. Es tu misma cuenta: no hay registro ni contraseña nuevos.</li>
          </ol>

          {message && (
            <p className="text-base" role="alert">
              {message}
            </p>
          )}

          <form action={connectReader} className="grid gap-3">
            <Label htmlFor="token">Token de panfleto</Label>
            <Input
              autoComplete="off"
              id="token"
              name="token"
              required
              spellCheck={false}
              type="password"
            />
            <Button type="submit">Conectar</Button>
          </form>

          <p className="text-sm">
            El token se guarda cifrado en una cookie de este sitio y solo se usa, desde el servidor, para
            leer tus fuentes. Si lo cambias en panfleto, esta conexión se cierra sola.
          </p>
        </section>
      )}
    </div>
  )
}

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Conecta tu edición',
}
