import type { CollectionAfterChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { adminFieldOnly, adminOnly, isAdmin, isEditor, isWriter } from '../../access/roles'
import {
  createFirstUserAsAdmin,
  preventLastAdminDelete,
  preventLastAdminRoleRemoval,
} from './hooks/protectRoles'
import { getServerSideURL } from '@/utilities/getURL'

type UserRole = 'admin' | 'editor' | 'writer'

const escapeHTML = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getRoleInstructions = (role?: UserRole | null) => {
  if (role === 'admin') {
    return 'Podrás gestionar usuarios, configuración editorial y todo el contenido publicado en el sitio.'
  }

  if (role === 'editor') {
    return 'Podrás revisar borradores, editar piezas y coordinar su publicación cuando estén listas.'
  }

  return 'Podrás crear borradores y enviarlos a revisión. Un editor se encargará de publicar cuando el texto esté listo.'
}

const inviteEmailSubject = () => 'Tu acceso a Editorial Panfleto'

const inviteEmailHTML = ({
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
  const logoURL = `${baseURL}/logo-horizontal-dark.svg`
  const greeting = user?.name ? `Hola ${escapeHTML(user.name)},` : 'Hola,'
  const safeLogoURL = escapeHTML(logoURL)
  const safeResetURL = escapeHTML(resetURL)
  const roleInstructions = getRoleInstructions(user?.role)

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.55; color: #171513; background: #ffffff; max-width: 620px; margin: 0 auto; padding: 28px 24px;">
      <div style="padding-bottom: 18px; border-bottom: 1px solid #e6e0d8; margin-bottom: 24px;">
        <img src="${safeLogoURL}" alt="Editorial Panfleto" width="180" style="display: block; width: 180px; max-width: 100%; height: auto;" />
      </div>
      <p style="margin: 0 0 16px;">${greeting}</p>
      <p style="margin: 0 0 16px;">Tu cuenta en <strong>Editorial Panfleto</strong> ya está lista. Para entrar al panel editorial, crea tu contraseña con el botón de abajo.</p>
      <p style="margin: 0 0 20px;">
        <a href="${safeResetURL}" style="display: inline-block; background: #171513; color: #ffffff; padding: 12px 18px; text-decoration: none; font-weight: 700; border-radius: 4px;">
          Crear contraseña e iniciar sesión
        </a>
      </p>
      <p style="margin: 0 0 8px;">También puedes copiar y pegar este enlace en tu navegador:</p>
      <p style="margin: 0 0 16px; word-break: break-word;"><a href="${safeResetURL}" style="color: #171513;">${safeResetURL}</a></p>
      <p style="margin: 0 0 24px;">${roleInstructions}</p>
      <p style="margin: 0;">Bienvenido,<br/>Editorial Panfleto</p>
    </div>
  `
}

const sendUserInvite: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !isAdmin(req.user) || !doc.email) return doc

  const token = await req.payload.forgotPassword({
    collection: 'users',
    data: {
      email: doc.email,
    },
    overrideAccess: true,
    req,
  })

  if (!token) {
    throw new Error(`User invite email was not sent because ${doc.email} could not be found.`)
  }

  req.payload.logger.info({
    msg: 'User invite email sent',
    userID: doc.id,
  })

  return doc
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
        inviteEmailHTML({ req: args?.req, token: args?.token, user: args?.user }),
      generateEmailSubject: inviteEmailSubject,
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
  ],
  hooks: {
    afterChange: [sendUserInvite],
    beforeChange: [createFirstUserAsAdmin, preventLastAdminRoleRemoval],
    beforeDelete: [preventLastAdminDelete],
  },
  timestamps: true,
}
