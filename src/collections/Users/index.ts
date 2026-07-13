import type {
  CollectionAfterChangeHook,
  CollectionAfterOperationHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'

import { adminFieldOnly, adminOnly, isAdmin, isEditor, isWriter } from '../../access/roles'
import { escapeHTML, renderSystemEmail } from '@/email/systemEmail'
import {
  createFirstUserAsAdmin,
  preventAssignedTaskOrphans,
  preventLastAdminDelete,
  preventLastAdminRoleRemoval,
} from './hooks/protectRoles'
import { getServerSideURL } from '@/utilities/getURL'

type UserRole = 'admin' | 'editor' | 'writer'

const getRoleInviteIntro = (role?: UserRole | null) => {
  if (role === 'admin') {
    return 'Te invitamos a administrar <strong>PANFLETO</strong>. Tu cuenta ya está lista; solo necesitas crear tu contraseña para entrar al panel editorial.'
  }

  if (role === 'editor') {
    return 'Te invitamos a editar en <strong>PANFLETO</strong>. Tu cuenta ya está lista; solo necesitas crear tu contraseña para entrar al panel editorial.'
  }

  return 'Te invitamos a escribir en <strong>PANFLETO</strong>. Tu cuenta ya está lista; solo necesitas crear tu contraseña para entrar al panel editorial.'
}

const getRoleInstructions = (role?: UserRole | null) => {
  if (role === 'admin') {
    return 'Cuando entres, podrás gestionar usuarios, configuración editorial y todo el contenido publicado en el sitio.'
  }

  if (role === 'editor') {
    return 'Cuando entres, podrás revisar borradores, editar piezas y coordinar su publicación cuando estén listas.'
  }

  return 'Cuando entres, podrás crear borradores y enviarlos a revisión. Un editor se encargará de publicar cuando el texto esté listo.'
}

const getOnboardingBody = (role?: UserRole | null) => {
  if (role === 'admin') {
    return [
      'Tu meta es dejar el espacio listo para que el equipo pueda publicar sin fricción.',
      'Empieza por revisar usuarios, navegación, secciones y el contenido publicado. Desde ahí puedes ajustar permisos, crear estructura editorial y acompañar el flujo completo.',
      'Prueba entrar al panel, abrir Usuarios y revisar una pieza publicada. Eso te dará el mapa básico de operación.',
    ]
  }

  if (role === 'editor') {
    return [
      'Tu meta es convertir borradores en piezas listas para publicar.',
      'Empieza por revisar los artículos en cola, abrir las asignaciones activas y dejar comentarios o ajustes claros para quien escribe.',
      'Prueba abrir el tablero editorial y mover una pieza por el flujo. Con eso verás dónde coordinar revisión, edición y publicación.',
    ]
  }

  return [
    'Tu meta es crear borradores claros y enviarlos a revisión cuando estén listos.',
    'Empieza creando un artículo, elige su sección, guarda avances como borrador y envíalo a revisión cuando quieras que un editor lo lea.',
    'Prueba abrir Artículos y crear tu primer borrador. No necesitas publicarlo: el panel está hecho para que puedas avanzar paso a paso.',
  ]
}

export const inviteEmailSubject = () => 'Tu acceso a PANFLETO'

export const resetPasswordEmailSubject = () => 'Restablece tu contraseña de Panfleto'

export const inviteEmailHTML = ({
  req,
  token,
  user,
}: {
  req?: PayloadRequest
  token?: string
  user?: { name?: string | null; role?: UserRole | null }
}) => {
  const baseURL = req?.origin || getServerSideURL()
  const resetURL = `${baseURL}/admin/reset/${token}`
  const greeting = user?.name ? `Hola ${user.name},` : 'Hola,'
  const roleInstructions = getRoleInstructions(user?.role)
  const safeResetURL = escapeHTML(resetURL)

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#171513;max-width:760px;">
      <p>${escapeHTML(greeting)}</p>
      <p>${getRoleInviteIntro(user?.role)}</p>
      <p>
        <a href="${safeResetURL}" style="display:inline-block;background:#ffffff;color:#171513;padding:12px 16px;text-decoration:none;font-weight:700;border:2px solid #171513;border-radius:4px;">
          Crear contraseña e iniciar sesión
        </a>
      </p>
      <p>También puedes copiar y pegar este enlace en tu navegador:</p>
      <p><a href="${safeResetURL}">${safeResetURL}</a></p>
      <p>${escapeHTML(roleInstructions)}</p>
      <p>Bienvenido/a,<br/>Equipo PANFLETO</p>
    </div>
  `
}

export const resetPasswordEmailHTML = ({
  req,
  token,
  user,
}: {
  req?: PayloadRequest
  token?: string
  user?: { name?: string | null }
}) => {
  const baseURL = req?.origin || getServerSideURL()
  const resetURL = `${baseURL}/admin/reset/${token}`
  const greeting = user?.name ? `Hola ${user.name},` : 'Hola,'

  return renderSystemEmail({
    action: {
      href: resetURL,
      label: 'Restablecer contraseña',
    },
    body: [
      'Recibimos una solicitud para restablecer tu contraseña de Panfleto.',
      'Si fuiste tú, usa este enlace para crear una nueva contraseña. Si no solicitaste el cambio, puedes ignorar este correo.',
    ],
    eyebrow: 'Seguridad de la cuenta',
    greeting,
    req,
    title: 'Restablece tu contraseña',
  })
}

export const onboardingEmailHTML = ({
  req,
  user,
}: {
  req?: PayloadRequest
  user?: { name?: string | null; role?: UserRole | null }
}) => {
  const baseURL = req?.origin || getServerSideURL()
  const dashboardURL = `${baseURL}/admin`
  const greeting = user?.name ? `Hola ${user.name},` : 'Hola,'

  return renderSystemEmail({
    action: {
      href: dashboardURL,
      label: 'Abrir panel',
    },
    body: getOnboardingBody(user?.role),
    eyebrow: 'Primeros pasos',
    greeting,
    req,
    title: 'Bienvenido/a a Panfleto',
  })
}

export const sendUserInvite: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !isAdmin(req.user) || !doc.email) {
    return doc
  }

  const token = await req.payload.forgotPassword({
    collection: 'users',
    data: {
      email: doc.email,
    },
    disableEmail: true,
    overrideAccess: true,
    req,
  })

  if (!token) {
    throw new Error(`User invite email was not sent because ${doc.email} could not be found.`)
  }

  await req.payload.sendEmail({
    to: doc.email,
    subject: inviteEmailSubject(),
    html: inviteEmailHTML({ req, token, user: doc }),
  })

  req.payload.logger.info({
    msg: 'User invite email sent',
    userID: doc.id,
  })

  return doc
}

export const sendOnboardingEmailAfterPasswordSetup: CollectionAfterOperationHook<'users'> = async ({
  operation,
  req,
  result,
}) => {
  if (operation !== 'resetPassword') {
    return result
  }

  const user = result?.user

  const userID = user?.id

  if (
    (typeof userID !== 'number' && typeof userID !== 'string') ||
    !user.email ||
    user.onboardingEmailSentAt
  ) {
    return result
  }

  await req.payload.sendEmail({
    to: user.email,
    subject: 'Primeros pasos en Panfleto',
    html: onboardingEmailHTML({ req, user }),
  })

  await req.payload.update({
    id: userID,
    collection: 'users',
    data: {
      onboardingEmailSentAt: new Date().toISOString(),
    },
    overrideAccess: true,
    req,
  })

  req.payload.logger.info({
    msg: 'User onboarding email sent',
    userID,
  })

  return result
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => isAdmin(user) || isEditor(user) || isWriter(user),
    create: async ({ req }) => {
      if (isAdmin(req.user)) return true

      const userCount = await req.payload.count({
        collection: 'users',
        overrideAccess: true,
      })

      return userCount.totalDocs === 0
    },
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      if (user?.id) {
        return {
          id: {
            equals: user.id,
          },
        }
      }
      return false
    },
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  auth: {
    forgotPassword: {
      expiration: 1000 * 60 * 60 * 24 * 7,
      generateEmailHTML: (args) =>
        resetPasswordEmailHTML({ req: args?.req, token: args?.token, user: args?.user }),
      generateEmailSubject: resetPasswordEmailSubject,
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      access: {
        create: adminFieldOnly,
        update: adminFieldOnly,
      },
      defaultValue: 'writer',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        {
          label: 'Writer',
          value: 'writer',
        },
      ],
      required: true,
    },
    {
      name: 'onboardingEmailSentAt',
      type: 'date',
      admin: {
        hidden: true,
      },
    },
  ],
  hooks: {
    afterChange: [sendUserInvite],
    afterOperation: [sendOnboardingEmailAfterPasswordSetup],
    beforeChange: [createFirstUserAsAdmin, preventLastAdminRoleRemoval],
    beforeDelete: [preventLastAdminDelete, preventAssignedTaskOrphans],
  },
  timestamps: true,
}
