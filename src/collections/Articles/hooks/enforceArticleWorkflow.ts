import type { CollectionBeforeChangeHook } from 'payload'

import { isAdminOrEditor, isWriter } from '../../../access/roles'

export const enforceArticleWorkflow: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation === 'create' && !data.owner && req.user?.id) {
    data.owner = req.user.id
  }

  if (isWriter(req.user)) {
    const requestedPublishedStatus =
      data._status === 'published' || data.editorialStatus === 'published'
    const alreadyPublished =
      originalDoc?._status === 'published' || originalDoc?.editorialStatus === 'published'

    if (requestedPublishedStatus || alreadyPublished) {
      throw new Error('Writers can save drafts and request review, but cannot publish articles.')
    }
  }

  if (isAdminOrEditor(req.user) && data.editorialStatus === 'published') {
    data._status = 'published'
  }

  if (data._status === 'published') {
    data.editorialStatus = 'published'
    data.publishedAt = data.publishedAt || new Date().toISOString()
  }

  data.updatedDate = new Date().toISOString()

  return data
}
