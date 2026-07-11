'use client'

import { Button, toast } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import './index.scss'

type Option = {
  id: number | string
  name: string
}

const baseClass = 'miniflux-ad-hoc-import'

const fetchOptions = async (collection: 'authors' | 'sections'): Promise<Option[]> => {
  const response = await fetch(`/api/${collection}?depth=0&limit=100`, {
    credentials: 'include',
  })

  if (!response.ok) return []

  const data = await response.json()

  return (data.docs || []).map((doc: { id: number | string; name: string }) => ({
    id: doc.id,
    name: doc.name,
  }))
}

export const MinifluxAdHocImport: React.FC = () => {
  const [authors, setAuthors] = useState<Option[]>([])
  const [sections, setSections] = useState<Option[]>([])
  const [authorId, setAuthorId] = useState('')
  const [input, setInput] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [sectionId, setSectionId] = useState('')

  useEffect(() => {
    void Promise.all([fetchOptions('authors'), fetchOptions('sections')]).then(
      ([nextAuthors, nextSections]) => {
        setAuthors(nextAuthors)
        setSections(nextSections)
        setAuthorId(String(nextAuthors[0]?.id || ''))
        setSectionId(String(nextSections[0]?.id || ''))
      },
    )
  }, [])

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!input || !sectionId || !authorId) {
      toast.error('Choose a section and author, then enter a Miniflux entry ID or URL.')
      return
    }

    setIsImporting(true)

    try {
      const response = await fetch('/api/miniflux/import-entry', {
        body: JSON.stringify({ authorId, input, sectionId }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed.')
      }

      toast.success(result.created ? 'Draft article created.' : 'Existing draft refreshed.')

      if (result.articleId) {
        window.location.assign(`/admin/collections/articles/${result.articleId}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.'
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <form className={baseClass} onSubmit={handleImport}>
      <h3>Import one Miniflux article</h3>
      <div className={`${baseClass}__grid`}>
        <label>
          Entry ID or URL
          <input
            onChange={(event) => setInput(event.target.value)}
            placeholder="12345 or Miniflux entry URL"
            type="text"
            value={input}
          />
        </label>
        <label>
          Section
          <select onChange={(event) => setSectionId(event.target.value)} value={sectionId}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Author
          <select onChange={(event) => setAuthorId(event.target.value)} value={authorId}>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button buttonStyle="primary" disabled={isImporting} size="medium" type="submit">
        {isImporting ? 'Importing...' : 'Import draft'}
      </Button>
    </form>
  )
}

export default MinifluxAdHocImport
