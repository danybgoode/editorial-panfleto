// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { publisherOf, rankEdition, type SlimEntry } from '@/lib/personalized/ranking'

// Sprint 3.1 (fluxonline personalized-edition): v1 ranks as the spike ran it.

const NOW = Date.UTC(2026, 8, 16, 12)
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()

let nextId = 1
const entry = (overrides: Partial<SlimEntry>): SlimEntry => {
  const id = nextId++
  return {
    categoryTitle: 'News',
    commentsUrl: '',
    contentLength: 100,
    excerpt: '',
    feedId: id,
    feedTitle: `Feed ${id}`,
    id,
    publishedAt: hoursAgo(1),
    readingTime: 1,
    siteUrl: `https://site${id}.example`,
    title: `Headline ${['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'][id % 8]} ${id}x${id}`,
    url: `https://site${id}.example/story/${id}`,
    ...overrides,
  }
}

const rank = (entries: SlimEntry[], hnComments: Record<string, number> = {}) =>
  rankEdition({ entries, hnComments, now: NOW })

describe('corroboration counts publishers, not feeds', () => {
  it('does not let two feeds from one publisher corroborate each other', () => {
    const bbcWorld = entry({
      feedTitle: 'BBC News - World',
      siteUrl: 'https://www.bbc.co.uk/news/world',
      title: 'Dutch rail network hit by suspected sabotage attack',
    })
    const bbcTop = entry({
      feedTitle: 'BBC News',
      siteUrl: 'https://www.bbc.com/news',
      title: 'Dutch rail network hit by suspected sabotage attack',
      url: 'https://www.bbc.com/news/other-url',
    })

    const [story] = rank([bbcWorld, bbcTop]).front
    expect(rank([bbcWorld, bbcTop]).front).toHaveLength(1)
    expect(story.sources).toEqual(['BBC'])
    expect(story.score).toBeCloseTo(0.5 ** (1 / 6))
  })

  it('does corroborate across two publishers, and shows the story once with both listed', () => {
    const bbc = entry({
      siteUrl: 'https://www.bbc.co.uk/news',
      title: 'Dutch rail network hit by suspected sabotage attack',
    })
    const guardian = entry({
      siteUrl: 'https://www.theguardian.com/world',
      title: 'Suspected sabotage attack hits Dutch rail network',
    })

    const edition = rank([bbc, guardian])
    expect(edition.front).toHaveLength(1)
    expect(edition.front[0].sources).toEqual(['BBC', 'theguardian.com'])
    expect(edition.front[0].score).toBeCloseTo(0.5 ** (1 / 6) * 1.5)
    expect(edition.clusterCount).toBe(1)
  })

  it('treats subdomains of one newsroom as one publisher', () => {
    expect(publisherOf({ siteUrl: 'https://rss.nytimes.com/services' })).toBe('NYT')
    expect(publisherOf({ siteUrl: 'https://www.eleconomista.com.mx/' })).toBe('eleconomista.com.mx')
  })
})

describe('the v1 score and quotas', () => {
  it('ranks a corroborated older story above a merely recent one, and weighs HN comments', () => {
    const recent = entry({
      publishedAt: hoursAgo(0.1),
      title: 'Theatre review of a new play in London',
    })
    const a = entry({
      publishedAt: hoursAgo(1),
      siteUrl: 'https://elpais.com',
      title: 'Morena define candidatura para Zacatecas hoy',
    })
    const b = entry({
      publishedAt: hoursAgo(1),
      siteUrl: 'https://reforma.com',
      title: 'Morena define hoy candidatura para Zacatecas',
    })
    const c = entry({
      publishedAt: hoursAgo(1),
      siteUrl: 'https://proceso.com.mx',
      title: 'Zacatecas: Morena define candidatura hoy',
    })
    const hn = entry({
      commentsUrl: 'https://news.ycombinator.com/item?id=1',
      publishedAt: hoursAgo(4),
      title: 'Show HN: a tiny text editor',
    })

    const front = rank([recent, a, b, c, hn], { [String(hn.id)]: 285 }).front
    expect(front[0].sources).toHaveLength(3)
    expect(front[0].score).toBeCloseTo(0.5 ** (1 / 6) * 2)
    expect(front[1].comments).toBe(285)
    expect(front[1].score).toBeCloseTo(0.5 ** (4 / 6) * (1 + Math.log10(286) / 2))
    expect(front[2].title).toBe('Theatre review of a new play in London')
  })

  it('allows at most one story per feed and three per category on the front, two per feed in a section', () => {
    const noisy = Array.from({ length: 5 }, (_, index) =>
      entry({
        feedId: 900,
        feedTitle: 'El Economista',
        publishedAt: hoursAgo(index * 0.1),
        title: `Nota económica distinta ${index} sobre mercados ${'abcde'[index]}`,
      }),
    )
    const tech = [
      'Rust compiler release',
      'Browser engine benchmark',
      'Database index tuning',
      'Kernel scheduler patch',
      'Terminal emulator fonts',
    ].map((title) => entry({ categoryTitle: 'Tech', title }))

    const edition = rank([...noisy, ...tech])
    const frontFeeds = edition.front.map((story) => story.feedTitle)
    expect(frontFeeds.filter((feed) => feed === 'El Economista')).toHaveLength(1)
    expect(edition.front.filter((story) => story.category === 'Tech')).toHaveLength(3)
    expect(edition.front).toHaveLength(4)

    const news = edition.sections.find((section) => section.category === 'News')
    expect(news?.stories.filter((story) => story.feedTitle === 'El Economista')).toHaveLength(2)
    const shown = [...edition.front, ...edition.sections.flatMap((section) => section.stories)].map(
      (s) => s.url,
    )
    expect(new Set(shown).size).toBe(shown.length)
  })
})
