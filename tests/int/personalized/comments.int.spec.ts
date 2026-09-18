// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  countDescendantComments,
  countThreadComments,
  getHackerNewsItemId,
  sanitizeCommentHTML,
  type HNComment,
} from '@/lib/comments/hackernews'
import { extractLeadImage } from '@/lib/personalized/reader'
import { slugify } from '@/utilities/editorial'

describe('Hacker News comments helper', () => {
  it('extracts item id from news.ycombinator.com URLs', () => {
    expect(getHackerNewsItemId('https://news.ycombinator.com/item?id=123456')).toBe('123456')
    expect(getHackerNewsItemId(undefined, 'https://news.ycombinator.com/item?id=98765')).toBe('98765')
    expect(getHackerNewsItemId('https://example.com/other')).toBeNull()
    expect(getHackerNewsItemId()).toBeNull()
  })

  it('sanitizes comment HTML securely', () => {
    const raw = '<p>Hello <script>alert(1)</script><a href="https://example.com">link</a><iframe src="evil"></iframe></p>'
    const sanitized = sanitizeCommentHTML(raw)
    expect(sanitized).not.toContain('<script>')
    expect(sanitized).not.toContain('<iframe>')
    expect(sanitized).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">')
  })

  it('counts descendant comments accurately', () => {
    const tree: HNComment = {
      id: 1,
      author: 'alice',
      created_at: '2026-09-17T12:00:00Z',
      text: 'First',
      children: [
        {
          id: 2,
          author: 'bob',
          created_at: '2026-09-17T12:05:00Z',
          text: 'Reply 1',
          children: [
            {
              id: 3,
              author: 'charlie',
              created_at: '2026-09-17T12:10:00Z',
              text: 'Reply 2',
              children: [],
            },
          ],
        },
      ],
    }

    expect(countDescendantComments(tree)).toBe(3)
    expect(countThreadComments([tree])).toBe(3)
  })
})

describe('Image extraction for personalized stories', () => {
  it('extracts image from image enclosure first', () => {
    const enclosures = [
      { mime_type: 'audio/mpeg', url: 'https://example.com/podcast.mp3' },
      { mime_type: 'image/jpeg', url: 'https://example.com/photo.jpg' },
    ]
    const content = '<p><img src="https://example.com/fallback.jpg" /></p>'
    expect(extractLeadImage(content, enclosures)).toBe('https://example.com/photo.jpg')
  })

  it('extracts image from content HTML when no enclosure is present', () => {
    const content = '<p>Some text</p><img src="https://cdn.example.com/article-lead.webp" alt="test" /><p>More text</p>'
    expect(extractLeadImage(content)).toBe('https://cdn.example.com/article-lead.webp')
  })

  it('ignores tracking pixels in content HTML', () => {
    const content = '<p><img src="https://feedburner.com/pixel.gif" width="1" height="1" /><img src="https://example.com/real-hero.jpg" /></p>'
    expect(extractLeadImage(content)).toBe('https://example.com/real-hero.jpg')
  })
})

describe('Slugify utility for sections', () => {
  it('converts category names into clean URL slugs', () => {
    expect(slugify('Política')).toBe('politica')
    expect(slugify('Economía')).toBe('economia')
    expect(slugify('Tecnología')).toBe('tecnologia')
    expect(slugify('Hacker News')).toBe('hacker-news')
    expect(slugify('PRUEBAS')).toBe('pruebas')
  })
})
