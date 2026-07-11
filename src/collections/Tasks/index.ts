import type { Access, CollectionConfig, FieldAccess, Where } from 'payload'

import { adminOnly, isAdminOrEditor, isWriter } from '@/access/roles'

import { sendTaskAssignmentEmail } from './hooks/sendTaskAssignmentEmail'
import { validateAssignedEditorialUser } from './hooks/validateAssignedEditorialUser'

const taskStatuses = [
  { label: 'To do', value: 'todo' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Under review', value: 'under_review' },
  { label: 'Completed', value: 'completed' },
]

const adminOrEditorField: FieldAccess = ({ req: { user } }) => isAdminOrEditor(user)

const readTasks: Access = ({ req: { user } }) => {
  if (isAdminOrEditor(user)) return true

  if (isWriter(user) && user?.id) {
    return {
      assignedTo: {
        equals: user.id,
      },
    } as Where
  }

  return false
}

const updateTasks: Access = ({ req: { user } }) => {
  if (isAdminOrEditor(user)) return true

  if (isWriter(user) && user?.id) {
    return {
      assignedTo: {
        equals: user.id,
      },
    } as Where
  }

  return false
}

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  access: {
    create: ({ req: { user } }) => isAdminOrEditor(user),
    delete: adminOnly,
    read: readTasks,
    update: updateTasks,
  },
  admin: {
    defaultColumns: ['title', 'assignedTo', 'status', 'deadline', 'article'],
    group: 'Editorial',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      access: {
        update: adminOrEditorField,
      },
      required: true,
    },
    {
      name: 'requirements',
      type: 'richText',
      access: {
        update: adminOrEditorField,
      },
      required: true,
    },
    {
      name: 'deadline',
      type: 'date',
      access: {
        update: adminOrEditorField,
      },
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'todo',
      options: taskStatuses,
      required: true,
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      access: {
        update: adminOrEditorField,
      },
      filterOptions: () => ({
        role: {
          in: ['writer', 'editor'],
        },
      }),
      label: 'Assigned to',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'article',
      type: 'relationship',
      label: 'Linked article',
      relationTo: 'articles',
    },
  ],
  hooks: {
    afterChange: [sendTaskAssignmentEmail],
    beforeValidate: [validateAssignedEditorialUser],
  },
  timestamps: true,
}
