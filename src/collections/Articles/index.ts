import type { CollectionConfig } from 'payload'

import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { slugField } from 'payload'

import { publicOrStaffPublished, writerOwnsArticleOrEditor, editorialStaff, adminOnly } from '../../access/roles'
import { Banner } from '../../blocks/Banner/config'
import { Code } from '../../blocks/Code/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { enforceArticleWorkflow } from './hooks/enforceArticleWorkflow'
import { populateAuthors } from './hooks/populateAuthors'
import { revalidateArticle, revalidateDelete } from './hooks/revalidateArticle'

export const Articles: CollectionConfig<'articles'> = {
  slug: 'articles',
  access: {
    create: editorialStaff,
    delete: adminOnly,
    read: publicOrStaffPublished,
    update: writerOwnsArticleOrEditor,
  },
  admin: {
    defaultColumns: ['headline', 'section', 'editorialStatus', '_status', 'publishedAt'],
    group: 'Editorial',
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'articles',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'articles',
        req,
      }),
    useAsTitle: 'headline',
  },
  defaultPopulate: {
    headline: true,
    slug: true,
    section: true,
    featuredImage: true,
    meta: {
      image: true,
      description: true,
    },
  },
  fields: [
    {
      name: 'headline',
      type: 'text',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
    },
    slugField({
      position: 'sidebar',
      useAsSlug: 'headline',
    }),
    {
      name: 'summary',
      type: 'textarea',
      label: 'Summary / Dek',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'featuredImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'gallery',
              type: 'array',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'caption',
                  type: 'textarea',
                },
              ],
              label: 'Supporting media',
            },
            {
              name: 'body',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => [
                  ...rootFeatures,
                  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                  BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                ],
              }),
              required: true,
            },
          ],
          label: 'Story',
        },
        {
          fields: [
            {
              name: 'author',
              type: 'relationship',
              relationTo: 'authors',
              required: true,
            },
            {
              name: 'coAuthors',
              type: 'relationship',
              hasMany: true,
              relationTo: 'authors',
            },
            {
              name: 'section',
              type: 'relationship',
              relationTo: 'sections',
              required: true,
            },
            {
              name: 'tags',
              type: 'relationship',
              hasMany: true,
              relationTo: 'tags',
            },
            {
              name: 'articleType',
              type: 'select',
              defaultValue: 'news',
              options: [
                { label: 'News', value: 'news' },
                { label: 'Editorial', value: 'editorial' },
                { label: 'Opinion', value: 'opinion' },
                { label: 'Interview', value: 'interview' },
                { label: 'Investigation', value: 'investigation' },
                { label: 'Feature', value: 'feature' },
                { label: 'Review', value: 'review' },
              ],
              required: true,
            },
            {
              name: 'editorialStatus',
              type: 'select',
              defaultValue: 'draft',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'In review', value: 'in-review' },
                { label: 'Ready', value: 'ready' },
                { label: 'Published', value: 'published' },
                { label: 'Archived', value: 'archived' },
              ],
              required: true,
            },
            {
              name: 'relatedArticles',
              type: 'relationship',
              filterOptions: ({ id }) => ({
                id: {
                  not_in: [id],
                },
              }),
              hasMany: true,
              relationTo: 'articles',
            },
          ],
          label: 'Metadata',
        },
        {
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
              overrides: {
                label: 'SEO title',
              },
            }),
            MetaDescriptionField({
              overrides: {
                label: 'SEO description',
              },
            }),
            {
              name: 'canonicalURL',
              type: 'text',
              label: 'Canonical URL',
            },
            {
              name: 'minifluxId',
              type: 'text',
              admin: {
                readOnly: true,
              },
              label: 'Miniflux ID',
              unique: true,
            },
            {
              name: 'minifluxSourceTitle',
              type: 'text',
              admin: {
                readOnly: true,
              },
              label: 'Miniflux source',
            },
            {
              name: 'minifluxImportedAt',
              type: 'date',
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                readOnly: true,
              },
              label: 'Miniflux imported at',
            },
            MetaImageField({
              relationTo: 'media',
              overrides: {
                label: 'Social image',
              },
            }),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
          label: 'SEO',
          name: 'meta',
        },
        {
          fields: [
            {
              name: 'printNotes',
              type: 'textarea',
            },
            {
              name: 'printEdition',
              type: 'relationship',
              relationTo: 'issues',
            },
          ],
          label: 'Print',
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'updatedDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      admin: {
        position: 'sidebar',
      },
      defaultValue: false,
      label: 'Featured',
    },
    {
      name: 'breakingNews',
      type: 'checkbox',
      admin: {
        position: 'sidebar',
      },
      defaultValue: false,
      label: 'Breaking news',
    },
    {
      name: 'trendingMultiplier',
      type: 'number',
      admin: {
        description: 'Boost or dampen this story in Redis-backed top-news ranking.',
        position: 'sidebar',
      },
      defaultValue: 1,
      label: 'Trending multiplier',
      max: 10,
      min: 0,
    },
    {
      name: 'trendingMetrics',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/TrendingMetricsPanel',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      relationTo: 'users',
    },
    {
      name: 'populatedAuthors',
      type: 'array',
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: 'id',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateArticle],
    afterDelete: [revalidateDelete],
    afterRead: [populateAuthors],
    beforeChange: [enforceArticleWorkflow],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 800,
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
