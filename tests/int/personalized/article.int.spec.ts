// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPaywallBypassLinks } from '@/components/Editorial/PaywallRail'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import {
  extractCitedArticleUrl,
  isAggregatorUrl,
} from '@/lib/personalized/aggregator'
import {
  fetchReaderArticle,
  isThinContent,
  normalizeReaderContent,
  stripTags,
} from '@/lib/personalized/reader'

const TOKEN = 'TESTTOKENFORARTICLEVIEW000000000'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Aggregator detection and URL extraction', () => {
  it('detects Techmeme as an aggregator', () => {
    expect(isAggregatorUrl('https://techmeme.com/240902/p2#a240902p2')).toBe(true)
    expect(isAggregatorUrl('https://www.techmeme.com/240902/p2')).toBe(true)
    expect(isAggregatorUrl('https://example.com/article')).toBe(false)
  })

  it('extracts the first cited article URL from Techmeme HTML', () => {
    const techmemeHtml = `
      <p>Apple released iOS 20 with new features.</p>
      <a href="https://techcrunch.com/2026/09/29/apple-ios-20-features">Apple iOS 20 Features</a>
      <a href="https://theverge.com/apple-ios-20-review">Review</a>
      <a href="https://twitter.com/apple/status/123">Twitter</a>
    `
    const cited = extractCitedArticleUrl(techmemeHtml)
    expect(cited).toBe('https://techcrunch.com/2026/09/29/apple-ios-20-features')
  })

  it('skips aggregator and social media links when extracting cited URL', () => {
    const html = `
      <a href="https://techmeme.com/link">Skip Techmeme</a>
      <a href="https://twitter.com/user/status/123">Skip Twitter</a>
      <a href="https://bit.ly/techmeme">Skip bit.ly to Techmeme</a>
      <a href="https://real-article.com/story">Real Article</a>
    `
    const cited = extractCitedArticleUrl(html)
    expect(cited).toBe('https://real-article.com/story')
  })

  it('returns undefined when no valid cited URL is found', () => {
    const html = '<p>No links here</p>'
    expect(extractCitedArticleUrl(html)).toBeUndefined()
  })
})

describe('Paywall Bypass rail links', () => {
  it('generates the bypass links including RemovePaywall', () => {
    const articleURL = 'https://www.theguardian.com/world/2026/sep/17/example-story'
    const links = getPaywallBypassLinks(articleURL)

    expect(links).toEqual([
      {
        name: 'Archive.ph',
        url: 'https://archive.ph/newest/https://www.theguardian.com/world/2026/sep/17/example-story',
      },
      {
        name: 'Archive.is',
        url: 'https://archive.is/newest/https://www.theguardian.com/world/2026/sep/17/example-story',
      },
      {
        name: 'unwall.app',
        url: 'https://unwall.app/www.theguardian.com/world/2026/sep/17/example-story',
      },
      {
        name: 'RemovePaywall',
        url: 'https://www.removepaywall.com/search?url=https%3A%2F%2Fwww.theguardian.com%2Fworld%2F2026%2Fsep%2F17%2Fexample-story',
      },
    ])
  })

  it('strips http:// correctly for unwall.app', () => {
    const articleURL = 'http://elpais.com/sociedad/articulo.html'
    const links = getPaywallBypassLinks(articleURL)

    expect(links.find((l) => l.name === 'unwall.app')?.url).toBe(
      'https://unwall.app/elpais.com/sociedad/articulo.html',
    )
  })
})

describe('normalizeReaderContent', () => {
  it('strips style tags, style attributes, and non-img width/height', () => {
    const raw = `
      <style>.wide { width: 900px; }</style>
      <link rel="stylesheet" href="https://example.com/a.css">
      <div style="width: 900px; white-space: nowrap" width="900" height="40">
        <p style="white-space:nowrap">Hello world</p>
        <img src="https://example.com/a.jpg" width="1200" height="800" alt="">
        <table width="1024"><tr><td>cell</td></tr></table>
      </div>
    `
    const out = normalizeReaderContent(raw)
    expect(out).not.toContain('<style')
    expect(out).not.toContain('<link')
    expect(out).not.toMatch(/\sstyle=/i)
    expect(out).toContain('<img src="https://example.com/a.jpg" width="1200" height="800" alt="">')
    expect(out).not.toMatch(/<table[^>]*width=/i)
    expect(out).toContain('Hello world')
    expect(out).toContain('<td>cell</td>')
  })

  it('promotes lazy-loaded images and injects an enclosure hero when the body has none', () => {
    const lazy = '<p>Daily cartoon</p><img data-src="https://media.newyorker.com/cartoon.jpg" alt="">'
    expect(normalizeReaderContent(lazy)).toContain('src="https://media.newyorker.com/cartoon.jpg"')

    const noImg = '<p>Caption without a bitmap in the body.</p>'
    const withHero = normalizeReaderContent(noImg, {
      leadImageUrl: 'https://media.newyorker.com/daily.jpg',
    })
    expect(withHero).toContain('article-reader-hero')
    expect(withHero).toContain('https://media.newyorker.com/daily.jpg')
  })

  it('strips NYT and Techmeme reading chrome without dropping the story', () => {
    const raw = `
      <nav><a href="/live">Live Updates</a></nav>
      <p>Advertisement</p>
      <a>SKIP ADVERTISEMENT</a>
      <p>You have a preview view of this article while we are checking your access. When we have confirmed access, the full article content will load.</p>
      <p>Democrats in Congress Embrace a More Punitive Posture Toward Israel</p>
      <p>Nearly every Democratic senator voted to advance a measure calling for a human rights report.</p>
      <audio controls></audio>
      <p>Listen · 6:41 min</p>
      <a>Share full article</a>
    `
    const out = normalizeReaderContent(raw)
    expect(out).toContain('Democrats in Congress Embrace')
    expect(out).toContain('Nearly every Democratic senator')
    expect(out).not.toMatch(/Advertisement/i)
    expect(out).not.toMatch(/SKIP ADVERTISEMENT/i)
    expect(out).not.toMatch(/Share full article/i)
    expect(out).not.toMatch(/Listen · 6:41/i)
    expect(out).not.toMatch(/preview view of this article/i)
    expect(out).not.toMatch(/<audio/i)

    const techmeme = `
      <p>Apple released iOS 20.</p>
      <ul>
        <li><a href="https://techcrunch.com/a">A</a></li>
        <li><a href="https://theverge.com/b">B</a></li>
        <li><a href="https://arstechnica.com/c">C</a></li>
        <li><a href="https://wired.com/d">D</a></li>
      </ul>
    `
    const farm = normalizeReaderContent(techmeme, { dropLinkFarms: true })
    expect(farm).toContain('Apple released iOS 20')
    expect(farm).not.toContain('techcrunch.com')
  })

  it('leaves ordinary paragraphs unchanged', () => {
    const html = '<p>Contenido amplio y completo del artículo de noticias. </p>'
    expect(normalizeReaderContent(html)).toBe(html)
  })
})

describe('isThinContent and stripTags', () => {
  it('strips HTML tags and checks thin content threshold', () => {
    expect(stripTags('<p>Hola <strong>mundo</strong></p>')).toBe('Hola mundo')
    expect(isThinContent('')).toBe(true)
    expect(isThinContent('<p>Short excerpt</p>')).toBe(true)
    expect(isThinContent('<p>' + 'word '.repeat(250) + '</p>')).toBe(false)
  })
})

describe('fetchReaderArticle', () => {
  it('returns full article without scraping when entry already has substantial content', async () => {
    const longContent = '<p>' + 'Contenido amplio y completo del artículo de noticias. '.repeat(40) + '</p>'
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/entries/42')) {
        return new Response(
          JSON.stringify({
            author: 'Redacción',
            content: longContent,
            feed: { id: 10, title: 'El País' },
            id: 42,
            published_at: '2026-09-17T10:00:00Z',
            reading_time: 4,
            title: 'Titular de prueba',
            url: 'https://elpais.com/ejemplo',
          }),
          { status: 200 },
        )
      }
      return new Response('Not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const article = await fetchReaderArticle(TOKEN, 42)

    expect(article.id).toBe(42)
    expect(article.title).toBe('Titular de prueba')
    expect(article.content).toBe(longContent)
    expect(article.isThin).toBe(false)
    expect(article.feedTitle).toBe('El País')
    // Did NOT call fetch-content because content was not thin
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('triggers Miniflux fetch-content when entry content is thin or empty', async () => {
    const thinContent = '<p>Teaser breve del artículo...</p>'
    const fullScrapedContent =
      '<p>' + 'Texto completo recuperado a través del scraper y unwall fallback de panfleto. '.repeat(35) + '</p>'

    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/entries/55/fetch-content')) {
        return new Response(
          JSON.stringify({
            content: fullScrapedContent,
            reading_time: 5,
          }),
          { status: 200 },
        )
      }
      if (url.includes('/entries/55')) {
        return new Response(
          JSON.stringify({
            content: thinContent,
            feed: { id: 20, title: 'BBC Mundo' },
            id: 55,
            published_at: '2026-09-17T11:00:00Z',
            title: 'Noticia con paywall o teaser',
            url: 'https://bbcmundo.example/story',
          }),
          { status: 200 },
        )
      }
      return new Response('Not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const article = await fetchReaderArticle(TOKEN, 55)

    expect(article.id).toBe(55)
    expect(article.content).toBe(fullScrapedContent)
    expect(article.isThin).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1][0]).toContain('/entries/55/fetch-content?update_content=true')
  })

  it('degrades gracefully if fetch-content fails and marks isThin true', async () => {
    const thinContent = '<p>Solo el resumen inicial del feed.</p>'

    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/entries/99/fetch-content')) {
        return new Response('Scraper error or anti-bot challenge', { status: 500 })
      }
      if (url.includes('/entries/99')) {
        return new Response(
          JSON.stringify({
            content: thinContent,
            feed: { id: 30, title: 'Paywalled Outlet' },
            id: 99,
            published_at: '2026-09-17T08:00:00Z',
            title: 'Noticia protegida',
            url: 'https://hardpaywall.example/story',
          }),
          { status: 200 },
        )
      }
      return new Response('Not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const article = await fetchReaderArticle(TOKEN, 99)

    expect(article.id).toBe(99)
    expect(article.content).toBe(thinContent)
    expect(article.isThin).toBe(true)
  })

  it('propagates 401 and 404 errors as MinifluxRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/entries/401')) {
          return new Response('Access Unauthorized', { status: 401 })
        }
        return new Response('Not Found', { status: 404 })
      }),
    )

    await expect(fetchReaderArticle(TOKEN, 401)).rejects.toThrow(MinifluxRequestError)
    await expect(fetchReaderArticle(TOKEN, 404)).rejects.toThrow(MinifluxRequestError)
  })
})
