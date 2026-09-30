// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchReaderArticle } from '@/lib/personalized/reader'

const TOKEN = 'TESTTOKENFORARTICLEVIEW000000000'

afterEach(() => {
  vi.unstubAllGlobals()
})

const linkList = Array.from(
  { length: 30 },
  (_, id) =>
    `<li><a href="https://www.bbc.com/news/articles/${id}">Headline number ${id} about something that happened today</a></li>`,
).join('')

const entry = (overrides: Record<string, unknown> = {}) => ({
  content: `<p>Talks resumed on Tuesday.</p><h2>More on this story</h2><ul>${linkList}</ul>`,
  enclosures: [{ mime_type: 'image/png', url: 'https://www.bbc.com/assets/facebook.png' }],
  feed: { id: 7, title: 'BBC News' },
  id: 700,
  published_at: '2026-09-29T09:00:00Z',
  title: 'Talks resume',
  url: 'https://www.bbc.com/news/articles/talks',
  ...overrides,
})

describe('an article whose feed body is mostly a list of links (BBC)', () => {
  it('is treated as thin, so the scraper is tried, and the list is gone from what is shown', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/entries/700/fetch-content')) return new Response('blocked', { status: 500 })
      if (url.includes('/entries/700')) return new Response(JSON.stringify(entry()), { status: 200 })
      return new Response('<html><head></head></html>', { headers: { 'content-type': 'text/html' }, status: 200 })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const article = await fetchReaderArticle(TOKEN, 700)

    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/entries/700/fetch-content'))).toBe(true)
    expect(article.isThin).toBe(true)
    expect(article.content).toContain('Talks resumed on Tuesday.')
    expect(article.content).not.toContain('Headline number')
    expect(article.content).not.toMatch(/More on this story/)
  })

  it('takes the publisher og:image when the feed only offered a share icon, and shows it as the hero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/entries/700/fetch-content')) return new Response('blocked', { status: 500 })
        if (url.includes('/entries/700')) return new Response(JSON.stringify(entry()), { status: 200 })
        if (url.startsWith('https://www.bbc.com/news/articles/talks')) {
          return new Response(
            '<html><head><meta property="og:image" content="https://ichef.bbci.co.uk/news/1024/talks.jpg"></head><body></body></html>',
            { headers: { 'content-type': 'text/html' }, status: 200 },
          )
        }
        return new Response('nope', { status: 404 })
      }),
    )

    const article = await fetchReaderArticle(TOKEN, 700)

    expect(article.leadImageUrl).toBe('https://ichef.bbci.co.uk/news/1024/talks.jpg')
    expect(article.content).toContain('article-reader-hero')
    expect(article.content).toContain('https://ichef.bbci.co.uk/news/1024/talks.jpg')
    expect(article.content).not.toContain('facebook.png')
  })

  it('leaves leadImageUrl empty, without failing, when the publisher offers nothing usable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/entries/700/fetch-content')) return new Response('blocked', { status: 500 })
        if (url.includes('/entries/700')) return new Response(JSON.stringify(entry()), { status: 200 })
        throw new Error('network down')
      }),
    )

    const article = await fetchReaderArticle(TOKEN, 700)

    expect(article.leadImageUrl).toBeUndefined()
    expect(article.isThin).toBe(true)
  })

  it('does not go looking for an image when the article came through in full', async () => {
    const body = '<p>' + 'Contenido amplio y completo del artículo de noticias. '.repeat(40) + '</p>'
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.includes('/entries/701')) {
        return new Response(JSON.stringify(entry({ content: body, id: 701 })), { status: 200 })
      }
      return new Response('nope', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const article = await fetchReaderArticle(TOKEN, 701)

    expect(article.isThin).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
