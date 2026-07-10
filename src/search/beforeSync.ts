import { BeforeSync, DocToSync } from '@payloadcms/plugin-search/types'

export const beforeSyncWithSearch: BeforeSync = async ({ req, originalDoc, searchDoc }) => {
  const {
    doc: { relationTo: collection },
  } = searchDoc

  const { slug, id, section, headline, summary, meta } = originalDoc

  const modifiedDoc: DocToSync = {
    ...searchDoc,
    slug,
    meta: {
      ...meta,
      title: meta?.title || headline,
      image: meta?.image?.id || meta?.image,
      description: meta?.description || summary,
    },
    sections: [],
  }

  if (section) {
    const populatedSections: { id: string | number; name: string }[] = []
    for (const sectionID of [section]) {
      if (!sectionID) {
        continue
      }

      if (typeof sectionID === 'object') {
        populatedSections.push(sectionID)
        continue
      }

      const doc = await req.payload.findByID({
        collection: 'sections',
        id: sectionID,
        disableErrors: true,
        depth: 0,
        select: { name: true },
        req,
      })

      if (doc !== null) {
        populatedSections.push(doc)
      } else {
        console.error(
          `Failed. Section not found when syncing collection '${collection}' with id: '${id}' to search.`,
        )
      }
    }

    modifiedDoc.sections = populatedSections.map((each) => ({
      relationTo: 'sections',
      sectionID: String(each.id),
      title: each.name,
    }))
  }

  return modifiedDoc
}
