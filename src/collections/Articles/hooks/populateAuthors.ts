import type { CollectionAfterReadHook } from 'payload'

export const populateAuthors: CollectionAfterReadHook = async ({ doc, req: { payload } }) => {
  const authorIDs = [
    doc?.author,
    ...(Array.isArray(doc?.coAuthors) ? doc.coAuthors : []),
  ]
    .map((author) => (typeof author === 'object' ? author?.id : author))
    .filter(Boolean)

  if (authorIDs.length === 0) return doc

  const authorDocs = await Promise.all(
    authorIDs.map(async (id) => {
      try {
        return await payload.findByID({
          id,
          collection: 'authors',
          depth: 0,
          overrideAccess: false,
        })
      } catch {
        return null
      }
    }),
  )

  doc.populatedAuthors = authorDocs
    .filter((authorDoc): authorDoc is NonNullable<typeof authorDoc> => Boolean(authorDoc))
    .map((authorDoc) => ({
      id: authorDoc.id,
      name: authorDoc.name,
    }))

  return doc
}
