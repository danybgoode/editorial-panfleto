// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  bestHttpFromSrcset,
  hashSeed,
  imageSizeHint,
  isUsableImageUrl,
} from '@/lib/personalized/images'
import { PLACEHOLDER_COUNT, placeholderIndex } from '@/components/Editorial/StoryPlaceholder'
import { extractLeadImage } from '@/lib/personalized/readerHtml'

describe('isUsableImageUrl', () => {
  it('accepts ordinary photographs', () => {
    expect(isUsableImageUrl('https://ichef.bbci.co.uk/news/1024/cpsprodpb/1234/senate-hearing.jpg')).toBe(true)
    expect(isUsableImageUrl('https://static01.nyt.com/images/2026/09/29/world/29israel/29israel-facebookJumbo.jpg')).toBe(true)
    expect(isUsableImageUrl('https://cdn.example.com/photo?id=42')).toBe(true)
  })

  it('rejects social and share furniture', () => {
    expect(isUsableImageUrl('https://example.com/assets/facebook.png')).toBe(false)
    expect(isUsableImageUrl('https://example.com/img/fb_share_icon.png')).toBe(false)
    expect(isUsableImageUrl('https://example.com/static/twitter-x-logo.png')).toBe(false)
    expect(isUsableImageUrl('https://static.xx.fbcdn.net/rsrc.php/v3/yx/r/abc.png')).toBe(false)
    expect(isUsableImageUrl('https://www.facebook.com/tr?id=123&ev=PageView')).toBe(false)
    expect(isUsableImageUrl('https://example.com/icons/whatsapp.png')).toBe(false)
  })

  it('rejects logos, avatars, sprites, favicons and tracking pixels', () => {
    for (const url of [
      'https://example.com/logo.png',
      'https://example.com/images/site-logo-dark.webp',
      'https://example.com/avatars/jane.jpg',
      'https://example.com/sprite.png',
      'https://example.com/favicon.png',
      'https://example.com/pixel.gif',
      'https://example.com/t/1x1.gif',
      'https://secure.gravatar.com/avatar/abc',
      'https://ad.doubleclick.net/x.png',
    ]) {
      expect(isUsableImageUrl(url), url).toBe(false)
    }
  })

  it('rejects vector and icon formats, which are never the photograph', () => {
    expect(isUsableImageUrl('https://example.com/share.svg')).toBe(false)
    expect(isUsableImageUrl('https://example.com/hero.svg')).toBe(false)
    expect(isUsableImageUrl('https://example.com/x.ico')).toBe(false)
  })

  it('keeps a photo whose long filename merely mentions a platform', () => {
    expect(
      isUsableImageUrl('https://example.com/2026/09/facebook-hearing-senate-zuckerberg-testifies.jpg'),
    ).toBe(true)
  })

  it('rejects URLs that say they are thumbnails', () => {
    expect(isUsableImageUrl('https://example.com/wp-content/uploads/2026/story-150x150.jpg')).toBe(false)
    expect(isUsableImageUrl('https://cdn.example.com/photo.jpg?w=96')).toBe(false)
    expect(isUsableImageUrl('https://cdn.example.com/photo.jpg?width=1200')).toBe(true)
    expect(imageSizeHint('https://example.com/a-300x200.jpg')).toBe(300)
    expect(imageSizeHint('https://example.com/a.jpg')).toBeUndefined()
  })

  it('rejects empty, relative and non-http values', () => {
    expect(isUsableImageUrl(undefined)).toBe(false)
    expect(isUsableImageUrl('')).toBe(false)
    expect(isUsableImageUrl('/images/a.jpg')).toBe(false)
    expect(isUsableImageUrl('data:image/png;base64,AAAA')).toBe(false)
  })
})

describe('bestHttpFromSrcset', () => {
  const srcset =
    'https://ichef.bbci.co.uk/news/240/a.jpg 240w, https://ichef.bbci.co.uk/news/480/a.jpg 480w, https://ichef.bbci.co.uk/news/1024/a.jpg 1024w, https://ichef.bbci.co.uk/news/2048/a.jpg 2048w'

  it('takes the widest entry, not the first thumbnail', () => {
    expect(bestHttpFromSrcset(srcset)).toBe('https://ichef.bbci.co.uk/news/2048/a.jpg')
  })

  it('can cap the width so a card does not download a 2048px original', () => {
    expect(bestHttpFromSrcset(srcset, { maxDescriptor: 1280 })).toBe('https://ichef.bbci.co.uk/news/1024/a.jpg')
    expect(bestHttpFromSrcset('https://x.test/a.jpg 3000w, https://x.test/b.jpg 4000w', { maxDescriptor: 1280 })).toBe(
      'https://x.test/a.jpg',
    )
  })

  it('keeps commas that belong to a URL', () => {
    expect(bestHttpFromSrcset('https://res.example.com/w_300,h_200/a.jpg 300w, https://res.example.com/w_900,h_600/a.jpg 900w')).toBe(
      'https://res.example.com/w_900,h_600/a.jpg',
    )
  })

  it('ignores non-http candidates', () => {
    expect(bestHttpFromSrcset('/a.jpg 1x, /b.jpg 2x')).toBeUndefined()
  })
})

describe('extractLeadImage', () => {
  it('skips a share-button logo and takes the next real picture', () => {
    const html = `
      <a href="https://facebook.com/share"><img src="https://example.com/assets/facebook.png" alt="Facebook"></a>
      <a href="https://twitter.com/share"><img src="https://example.com/assets/twitter.png" alt="Twitter"></a>
      <img src="https://cdn.example.com/2026/09/hearing-room.jpg" alt="">
    `
    expect(extractLeadImage(html)).toBe('https://cdn.example.com/2026/09/hearing-room.jpg')
  })

  it('returns undefined when every candidate is furniture, so the card shows a placeholder', () => {
    const html = `
      <img src="https://example.com/assets/facebook.png">
      <img src="https://example.com/logo.png">
      <img src="https://example.com/a.jpg" width="24" height="24">
    `
    expect(extractLeadImage(html)).toBeUndefined()
  })

  it('finds the real picture behind a lazy-load pixel', () => {
    const html = '<img src="https://example.com/pixel.gif" data-src="https://cdn.example.com/real-photo.jpg">'
    expect(extractLeadImage(html)).toBe('https://cdn.example.com/real-photo.jpg')
  })

  it('prefers the larger srcset entry over a thumbnail src', () => {
    const html =
      '<img src="https://cdn.example.com/photo-320.jpg" srcset="https://cdn.example.com/photo-320.jpg 320w, https://cdn.example.com/photo-960.jpg 960w">'
    expect(extractLeadImage(html)).toBe('https://cdn.example.com/photo-960.jpg')
  })

  it('takes a usable enclosure first and skips a logo enclosure', () => {
    expect(
      extractLeadImage('<img src="https://cdn.example.com/body.jpg">', [
        { mime_type: 'image/png', url: 'https://example.com/logo.png' },
        { mime_type: 'image/jpeg', url: 'https://cdn.example.com/enclosure.jpg' },
      ]),
    ).toBe('https://cdn.example.com/enclosure.jpg')
  })
})

describe('placeholder choice', () => {
  it('is stable for a story and spreads across the set', () => {
    expect(hashSeed('12345')).toBe(hashSeed('12345'))
    expect(placeholderIndex('12345')).toBe(placeholderIndex('12345'))

    const used = new Set(Array.from({ length: 200 }, (_, id) => placeholderIndex(String(id))))
    expect(used.size).toBe(PLACEHOLDER_COUNT)
    for (const index of used) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(PLACEHOLDER_COUNT)
    }
  })
})
