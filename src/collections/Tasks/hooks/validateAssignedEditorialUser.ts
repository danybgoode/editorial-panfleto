import type { CollectionBeforeValidateHook } from 'payload'

const allowedAssigneeRoles = new Set(['writer', 'editor'])

const getRelationID = (value: unknown) => {
  if (value && typeof value === 'object' && 'id' in value) return value.id as number | string

  return value as number | string | undefined
}

export const validateAssignedEditorialUser: CollectionBeforeValidateHook = async ({ data, req }) => {
  const assignedToID = getRelationID(data?.assignedTo)

  if (!assignedToID) return data

  const assignedTo = await req.payload.findByID({
    collection: 'users',
    id: assignedToID,
    overrideAccess: true,
    req,
  })

  if (!allowedAssigneeRoles.has(assignedTo.role || '')) {
    throw new Error('Tasks can only be assigned to writer or editor accounts.')
  }

  return data
}
