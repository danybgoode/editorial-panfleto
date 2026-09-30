'use client'

import React from 'react'
import { useFormStatus } from 'react-dom'

export function RefreshEditionButton() {
  const { pending } = useFormStatus()

  return (
    <button className="underline" disabled={pending} type="submit">
      {pending ? 'Actualizando…' : 'Actualizar'}
    </button>
  )
}
