import type { Access, FieldAccess, Where } from 'payload'

type EditorialRole = 'admin' | 'editor' | 'writer'
type EditorialUser = {
  id?: number | string
  role?: EditorialRole | null
}

export const isAdmin = (user?: EditorialUser | null): boolean => user?.role === 'admin'

export const isEditor = (user?: EditorialUser | null): boolean => user?.role === 'editor'

export const isWriter = (user?: EditorialUser | null): boolean => user?.role === 'writer'

export const isAdminOrEditor = (user?: EditorialUser | null): boolean =>
  isAdmin(user) || isEditor(user)

export const canAccessAdmin: Access = ({ req: { user } }) =>
  isAdmin(user) || isEditor(user) || isWriter(user)

export const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

export const adminFieldOnly: FieldAccess = ({ req: { user } }) => isAdmin(user)

export const adminOrEditorField: FieldAccess = ({ req: { user } }) => isAdminOrEditor(user)

export const adminOrEditor: Access = ({ req: { user } }) => isAdminOrEditor(user)

export const editorialStaff: Access = ({ req: { user } }) =>
  isAdmin(user) || isEditor(user) || isWriter(user)

export const publicOrStaffPublished: Access = ({ req: { user } }) => {
  if (user) return true

  return {
    and: [
      {
        _status: {
          equals: 'published',
        },
      },
      {
        editorialStatus: {
          equals: 'published',
        },
      },
    ],
  } as Where
}

export const writerOwnsArticleOrEditor: Access = ({ req: { user } }) => {
  if (isAdminOrEditor(user)) return true

  if (isWriter(user) && user?.id) {
    return {
      owner: {
        equals: user.id,
      },
    }
  }

  return false
}

export const publishedPublicOrStaff: Access = ({ req: { user } }) => {
  if (user) return true

  return {
    _status: {
      equals: 'published',
    },
  }
}
