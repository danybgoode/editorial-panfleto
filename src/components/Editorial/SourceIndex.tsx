'use client'

import Link from 'next/link'
import React, { useDeferredValue, useState } from 'react'

import { sourceHref } from './StoryCard'

export type SourceIndexGroup = {
  category: string
  sources: Array<{ host: string; id: number; initials: string; title: string; unread: number }>
  unread: number
}

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')

// The reader's subscriptions by category, filterable by name or domain as they type.
export function SourceIndex({ groups }: { groups: SourceIndexGroup[] }) {
  const [query, setQuery] = useState('')
  const needle = fold(useDeferredValue(query).trim())
  const visible = groups
    .map((group) => ({
      ...group,
      sources: needle
        ? group.sources.filter(
            (source) => fold(source.title).includes(needle) || source.host.includes(needle),
          )
        : group.sources,
    }))
    .filter((group) => group.sources.length > 0)

  return (
    <>
      <div className="source-index__filter">
        <label htmlFor="source-filter">Filtrar fuentes</label>
        <input
          autoComplete="off"
          id="source-filter"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o dominio"
          type="search"
          value={query}
        />
      </div>

      {visible.length === 0 && (
        <p className="source-index__none">Ninguna de tus fuentes coincide con «{query}».</p>
      )}

      {visible.map((group) => (
        <section className="source-index__group" id={group.category} key={group.category}>
          <h2>
            {group.category}
            <span>
              {group.sources.length === 1 ? '1 fuente' : `${group.sources.length} fuentes`}
              {group.unread > 0 && ` · ${group.unread} sin leer`}
            </span>
          </h2>
          <ul>
            {group.sources.map((source) => (
              <li key={source.id}>
                <Link href={sourceHref(source.id)} prefetch={false}>
                  <span aria-hidden className="source-index__mark">
                    {source.initials}
                  </span>
                  <span className="source-index__name">
                    <strong>{source.title}</strong>
                    <span>
                      {source.unread > 0 ? `${source.unread} sin leer` : 'al día'}
                      {source.host && ` · ${source.host}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
