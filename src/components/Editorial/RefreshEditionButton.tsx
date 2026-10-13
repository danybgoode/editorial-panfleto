'use client'

import React, { useActionState } from 'react'

import {
  refreshReaderEdition,
  type RefreshEditionState,
} from '@/app/(frontend)/tu-edicion/actions'

const INITIAL_STATE: RefreshEditionState = { status: 'idle' }

const messages: Record<Exclude<RefreshEditionState['status'], 'idle'>, string> = {
  busy: 'La edición ya se está preparando. Vuelve a intentarlo en un momento.',
  error: 'No pudimos actualizarla. Tu edición anterior sigue disponible.',
  unchanged: 'Al día: no llegaron historias nuevas.',
  updated: 'Edición actualizada.',
}

export function RefreshEditionButton() {
  const [state, action, pending] = useActionState(refreshReaderEdition, INITIAL_STATE)

  return (
    <form action={action} className="refresh-edition">
      <button
        aria-busy={pending}
        className="refresh-edition__button"
        disabled={pending}
        type="submit"
      >
        {pending && <span aria-hidden="true" className="refresh-edition__press">▌▌▌▌</span>}
        <span>{pending ? 'Preparando edición…' : 'Actualizar edición'}</span>
      </button>
      <span aria-live="polite" className="refresh-edition__status" role="status">
        {pending ? 'Preparando tu edición…' : state.status === 'idle' ? '' : messages[state.status]}
      </span>
    </form>
  )
}
