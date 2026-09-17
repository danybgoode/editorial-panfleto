// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPaywallBypassLinks } from '@/components/Editorial/PaywallRail'
import { MinifluxRequestError } from '@/lib/miniflux/client'
import { fetchReaderArticle, isThinContent, stripTags } from '@/lib/personalized/reader'

const TOKEN = 'TESTTOKENFORARTICLEVIEW000000000'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Paywall Bypass rail links', () => {
  it('generates the exact 3 links: archive.ph, archive.is, and unwall.app', () => {
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
