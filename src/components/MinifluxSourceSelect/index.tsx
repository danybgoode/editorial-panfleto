'use client'

import { SelectInput, toast, useField, useFormFields } from '@payloadcms/ui'
import type { ReactSelectOption } from '@payloadcms/ui'
import type { OptionObject } from 'payload'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type MinifluxCategory = {
  id: number
  title: string
}

type MinifluxFeed = {
  id: number
  title: string
  feed_url?: string
  site_url?: string
}

type CategoriesResponse = {
  categories?: MinifluxCategory[]
  error?: string
}

type FeedsResponse = {
  error?: string
  feeds?: MinifluxFeed[]
}

type SelectOption = OptionObject & {
  label: string
  value: string
}

type Props = {
  field?: {
    label?: string
    name?: string
    required?: boolean
  }
  path?: string
  readOnly?: boolean
}

const getOptionValue = (option: ReactSelectOption | ReactSelectOption[] | null | undefined) => {
  if (!option || Array.isArray(option)) return undefined
  return typeof option.value === 'string' ? option.value : String(option.value)
}

const getFeedLabel = (feed: MinifluxFeed) => {
  if (!feed.site_url && !feed.feed_url) return feed.title

  try {
    const url = new URL(feed.site_url || feed.feed_url || '')
    return `${feed.title} (${url.hostname})`
  } catch {
    return feed.title
  }
}

const toOption = ({ id, title }: MinifluxCategory | MinifluxFeed): SelectOption => ({
  label: title,
  value: String(id),
})

const toFeedOption = (feed: MinifluxFeed): SelectOption => ({
  label: getFeedLabel(feed),
  value: String(feed.id),
})

export const MinifluxSourceSelect: React.FC<Props> = ({ field, path: pathFromProps, readOnly }) => {
  const fieldPath = pathFromProps || field?.name || 'minifluxTargetId'
  const sourceType = useFormFields(
    ([fields]) => fields.sourceType?.value as 'category' | 'feed' | undefined,
  )

  const {
    disabled,
    path,
    setValue,
    showError,
    value: targetValue,
  } = useField<string | null>({
    path: fieldPath,
  })
  const { setValue: setTargetTitle } = useField<string | null>({
    path: 'minifluxTargetTitle',
  })

  const [categories, setCategories] = useState<MinifluxCategory[]>([])
  const [feeds, setFeeds] = useState<MinifluxFeed[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const previousSourceType = useRef(sourceType)

  const isFeedMode = sourceType === 'feed'

  const categoryOptions = useMemo(() => categories.map(toOption), [categories])
  const feedOptions = useMemo(() => feeds.map(toFeedOption), [feeds])

  useEffect(() => {
    if (previousSourceType.current && previousSourceType.current !== sourceType) {
      setValue(null)
      setTargetTitle(null)
      setSelectedCategoryId('')
      setFeeds([])
    }

    previousSourceType.current = sourceType
  }, [setTargetTitle, setValue, sourceType])

  useEffect(() => {
    const controller = new AbortController()

    const loadCategories = async () => {
      setIsLoadingCategories(true)
      setLoadError(null)

      try {
        const response = await fetch('/api/miniflux/categories', {
          credentials: 'include',
          signal: controller.signal,
        })
        const result = (await response.json()) as CategoriesResponse

        if (!response.ok || result.error || !result.categories) {
          throw new Error(result.error || 'Miniflux categories could not be loaded.')
        }

        setCategories(result.categories)
      } catch (error) {
        if (controller.signal.aborted) return

        const message =
          error instanceof Error ? error.message : 'Miniflux categories could not be loaded.'
        setLoadError(message)
        toast.error(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCategories(false)
        }
      }
    }

    void loadCategories()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!isFeedMode || !selectedCategoryId) {
      setFeeds([])
      return
    }

    const controller = new AbortController()

    const loadFeeds = async () => {
      setIsLoadingFeeds(true)
      setLoadError(null)

      try {
        const response = await fetch(
          `/api/miniflux/feeds?categoryId=${encodeURIComponent(selectedCategoryId)}`,
          {
            credentials: 'include',
            signal: controller.signal,
          },
        )
        const result = (await response.json()) as FeedsResponse

        if (!response.ok || result.error || !result.feeds) {
          throw new Error(result.error || 'Miniflux feeds could not be loaded.')
        }

        setFeeds(result.feeds)
      } catch (error) {
        if (controller.signal.aborted) return

        const message = error instanceof Error ? error.message : 'Miniflux feeds could not be loaded.'
        setLoadError(message)
        toast.error(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingFeeds(false)
        }
      }
    }

    void loadFeeds()

    return () => controller.abort()
  }, [isFeedMode, selectedCategoryId])

  const updateTarget = useCallback(
    (option: ReactSelectOption | ReactSelectOption[] | null | undefined, options: SelectOption[]) => {
      const nextValue = getOptionValue(option)
      const selectedOption = options.find(({ value }) => value === nextValue)

      setValue(nextValue || null)
      setTargetTitle(selectedOption?.label || null)
    },
    [setTargetTitle, setValue],
  )

  const handleCategoryChange = useCallback(
    (option: ReactSelectOption | ReactSelectOption[]) => {
      const nextCategoryId = getOptionValue(option) || ''
      setSelectedCategoryId(nextCategoryId)
      setFeeds([])

      if (isFeedMode) {
        setValue(null)
        setTargetTitle(null)
        return
      }

      updateTarget(option, categoryOptions)
    },
    [categoryOptions, isFeedMode, setTargetTitle, setValue, updateTarget],
  )

  const handleFeedChange = useCallback(
    (option: ReactSelectOption | ReactSelectOption[]) => {
      updateTarget(option, feedOptions)
    },
    [feedOptions, updateTarget],
  )

  const selectReadOnly = readOnly || disabled
  const categoryPlaceholder = isLoadingCategories ? 'Loading categories...' : 'Choose a category'
  const feedPlaceholder = !selectedCategoryId
    ? 'Choose a category first'
    : isLoadingFeeds
      ? 'Loading feeds...'
      : 'Choose a feed'

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <SelectInput
        isClearable
        label={isFeedMode ? 'Miniflux category' : field?.label || 'Miniflux category'}
        name={isFeedMode ? `${fieldPath}Category` : field?.name || fieldPath}
        onChange={handleCategoryChange}
        options={categoryOptions}
        path={isFeedMode ? `${path}Category` : path}
        placeholder={categoryPlaceholder}
        readOnly={selectReadOnly || isLoadingCategories}
        required={field?.required}
        showError={!isFeedMode && showError}
        value={isFeedMode ? selectedCategoryId : targetValue || undefined}
      />

      {isFeedMode && (
        <SelectInput
          isClearable
          label={field?.label || 'Miniflux feed'}
          name={field?.name || fieldPath}
          onChange={handleFeedChange}
          options={feedOptions}
          path={path}
          placeholder={feedPlaceholder}
          readOnly={selectReadOnly || !selectedCategoryId || isLoadingFeeds}
          required={field?.required}
          showError={showError}
          value={targetValue || undefined}
        />
      )}

      {loadError && (
        <p style={{ color: 'var(--theme-error-500)', fontSize: '0.875rem', margin: 0 }}>
          {loadError}
        </p>
      )}
    </div>
  )
}

export default MinifluxSourceSelect
