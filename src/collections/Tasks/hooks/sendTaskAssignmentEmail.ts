import type { CollectionAfterChangeHook } from 'payload'

import { lexicalToPlainText } from '@/email/lexicalPlainText'
import { getWorkspaceURL, renderSystemEmail } from '@/email/systemEmail'

type AssignedUser = {
  email?: string | null
  id?: number | string
  name?: string | null
}

const isAssignedUser = (value: unknown): value is AssignedUser =>
  Boolean(value && typeof value === 'object' && 'email' in value)

const formatDeadline = (deadline?: string | null) => {
  if (!deadline) return 'Sin fecha límite asignada.'

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(deadline))
}

export const sendTaskAssignmentEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const assignedTo = isAssignedUser(doc.assignedTo)
    ? doc.assignedTo
    : await req.payload.findByID({
        collection: 'users',
        id: doc.assignedTo,
        overrideAccess: true,
        req,
      })

  if (!assignedTo?.email) {
    req.payload.logger.warn({
      msg: 'Task assignment email skipped because the assigned user has no email.',
      taskID: doc.id,
    })

    return doc
  }

  const requirements = lexicalToPlainText(doc.requirements)
  const taskURL = `${getWorkspaceURL(req)}/admin/collections/tasks/${doc.id}`
  const greeting = assignedTo.name ? `Hola ${assignedTo.name},` : 'Hola,'

  await req.payload.sendEmail({
    to: assignedTo.email,
    subject: `Nueva asignación: ${doc.title}`,
    html: renderSystemEmail({
      action: {
        href: taskURL,
        label: 'Abrir asignación',
      },
      body: [
        `Tienes una nueva asignación en el espacio editorial: ${doc.title}.`,
        requirements || 'Los requisitos completos están disponibles en el panel editorial.',
        `Fecha de entrega: ${formatDeadline(doc.deadline)}`,
      ],
      eyebrow: 'Nueva asignación',
      greeting,
      req,
      title: doc.title,
    }),
  })

  req.payload.logger.info({
    msg: 'Task assignment email sent',
    taskID: doc.id,
    userID: assignedTo.id,
  })

  return doc
}
