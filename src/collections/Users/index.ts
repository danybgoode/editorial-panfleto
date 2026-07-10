import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { adminFieldOnly, adminOnly, isAdmin, isEditor, isWriter } from '../../access/roles'
import {
  createFirstUserAsAdmin,
  preventLastAdminDelete,
  preventLastAdminRoleRemoval,
} from './hooks/protectRoles'
import { getServerSideURL } from '@/utilities/getURL'

const writerInviteSubject = () => 'Tu acceso a PANFLETO'

const writerInviteHTML = ({
  token,
  user,
}: {
  token?: string
  user?: { name?: string | null }
}) => {
  const resetURL = `${getServerSideURL()}/admin/reset/${token}`
  const greeting = user?.name ? `Hola ${user.name},` : 'Hola,'

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #171513; max-width: 620px;">
      <p>${greeting}</p>
      <p>Te invitamos a escribir en <strong>PANFLETO</strong>. Tu cuenta ya está lista; solo necesitas crear tu contraseña para entrar al panel editorial.</p>
      <p>
        <a href="${resetURL}" style="display: inline-block; background: #171513; color: #ffffff; padding: 12px 16px; text-decoration: none; font-weight: 700;">
          Crear contraseña e iniciar sesión
        </a>
      </p>
      <p>También puedes copiar y pegar este enlace en tu navegador:</p>
      <p><a href="${resetURL}">${resetURL}</a></p>
      <p>Cuando entres, podrás crear borradores y enviarlos a revisión. Un editor se encargará de publicar cuando el texto esté listo.</p>
      <p>Bienvenido/a,<br/>Equipo PANFLETO</p>
    </div>
  `
}

const sendWriterInvite: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || doc.role !== 'writer' || !doc.email) return doc

  await req.payload.forgotPassword({
    collection: 'users',
    data: {
      email: doc.email,
    },
    overrideAccess: true,
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
      generateEmailHTML: (args) => writerInviteHTML({ token: args?.token, user: args?.user }),
      generateEmailSubject: writerInviteSubject,
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
    afterChange: [sendWriterInvite],
    beforeChange: [createFirstUserAsAdmin, preventLastAdminRoleRemoval],
    beforeDelete: [preventLastAdminDelete],
  },
  timestamps: true,
}
