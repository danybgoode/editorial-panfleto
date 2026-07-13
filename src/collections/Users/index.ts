import type { CollectionAfterChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { adminFieldOnly, adminOnly, isAdmin, isEditor, isWriter } from '../../access/roles'
import { renderSystemEmail } from '@/email/systemEmail'
import {
  createFirstUserAsAdmin,
  preventAssignedTaskOrphans,
  preventLastAdminDelete,
  preventLastAdminRoleRemoval,
} from './hooks/protectRoles'
import { getServerSideURL } from '@/utilities/getURL'

type UserRole = 'admin' | 'editor' | 'writer'

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
  const greeting = user?.name ? `Hola ${user.name},` : 'Hola,'
  const roleInstructions = getRoleInstructions(user?.role)

  return renderSystemEmail({
    action: {
      href: resetURL,
      label: 'Crear contrasena e iniciar sesion',
    },
    body: [
      'Tu cuenta en Editorial Panfleto ya esta lista. Crea tu contrasena para activar el acceso al panel editorial.',
      roleInstructions,
    ],
    eyebrow: 'Invitacion al espacio editorial',
    greeting,
    req,
    title: 'Activa tu espacio de trabajo',
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
    beforeDelete: [preventLastAdminDelete, preventAssignedTaskOrphans],
  },
  timestamps: true,
}
