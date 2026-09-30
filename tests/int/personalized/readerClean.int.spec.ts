// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  enhanceReaderImages,
  extractOpenGraphImage,
  isChromeText,
  stripReaderChrome,
} from '@/lib/personalized/readerHtml'
import { isThinAfterCleaning, normalizeReaderContent, stripTags } from '@/lib/personalized/reader'

const STORY = '<p>Nearly every Democratic senator voted to advance a measure calling for a human rights report on the use of American weapons.</p>'

// Verbatim from a scraped New York Times page.
const NYT_WALL =
  'See more of our coverage in your search results.Encuentra más de nuestra cobertura en los resultados de búsqueda. Add The New York Times on GoogleAgrega The New York Times en Google ' +
  'See more of our coverage in your search results.Encuentra más de nuestra cobertura en los resultados de búsqueda. Add The New York Times on GoogleAgrega The New York Times en Google' +
  'Thank you for your patience while we verify access. If you are in Reader mode please exit and log into your Times account, or subscribe for all of The Times.' +
  'Thank you for your patience while we verify access.Already a subscriber? Log in.Want all of The Times? Subscribe.Related Content'

describe('New York Times paywall and search-promo text', () => {
  it('is recognised as chrome when it arrives as one run-together blob', () => {
    expect(isChromeText(NYT_WALL)).toBe(true)
  })

  it('is removed from a page as one block, leaving the story', () => {
    const out = normalizeReaderContent(`<div>${NYT_WALL}</div>${STORY}`)
    expect(out).toContain('Nearly every Democratic senator')
    expect(out).not.toMatch(/See more of our coverage/i)
    expect(out).not.toMatch(/Encuentra más de nuestra cobertura/i)
    expect(out).not.toMatch(/Add The New York Times on Google/i)
    expect(out).not.toMatch(/verify access/i)
    expect(out).not.toMatch(/Already a subscriber/i)
    expect(out).not.toMatch(/Want all of The Times/i)
    expect(out).not.toMatch(/Related Content/i)
  })

  it('is removed when it is spread over separate elements', () => {
    const out = normalizeReaderContent(`
      <div class="promo"><p>See more of our coverage in your search results.</p><p>Encuentra más de nuestra cobertura en los resultados de búsqueda.</p>
        <a href="https://google.com/preferences">Add The New York Times on Google</a><a href="https://google.com/preferences">Agrega The New York Times en Google</a></div>
      <section><p>Thank you for your patience while we verify access.</p>
        <p>If you are in Reader mode please exit and log into your Times account, or subscribe for all of The Times.</p>
        <p>Already a subscriber? <a href="/login">Log in.</a></p><p>Want all of The Times? <a href="/subscribe">Subscribe.</a></p></section>
      ${STORY}
      <h3>Related Content</h3>
    `)
    expect(out).toContain('Nearly every Democratic senator')
    expect(out).not.toMatch(/coverage in your search|Encuentra|New York Times on Google|patience|Reader mode|subscriber|Subscribe/i)
    expect(out).not.toMatch(/Related Content/i)
  })

  it('removes the sentence when it is glued to a paragraph of real text', () => {
    const out = normalizeReaderContent(
      '<p>The vote came late on Tuesday. Thank you for your patience while we verify access. Senators left soon after.</p>',
    )
    expect(out).toContain('The vote came late on Tuesday.')
    expect(out).toContain('Senators left soon after.')
    expect(out).not.toMatch(/patience/i)
  })

  it('does not touch an article that merely mentions the Times', () => {
    const html = '<p>The New York Times reported on Tuesday that the subscriber count rose, and readers asked to log in less often.</p>'
    expect(normalizeReaderContent(html)).toBe(html)
  })
})

describe('depth-aware removal', () => {
  it('removes a nested chrome div without unbalancing the tree', () => {
    const html = '<div class="a"><div class="ad"><div>Advertisement</div></div><p>Real paragraph that stays.</p></div>'
    const out = stripReaderChrome(html)
    expect(out).toBe('<div class="a"><p>Real paragraph that stays.</p></div>')
    expect((out.match(/<div/g) || []).length).toBe((out.match(/<\/div>/g) || []).length)
  })

  it('never removes a container that holds a real picture, even beside share text', () => {
    const html = '<figure><img src="https://cdn.example.com/photo.jpg" alt=""><figcaption>Share</figcaption></figure>'
    expect(stripReaderChrome(html)).toContain('photo.jpg')
  })
})

describe('link lists', () => {
  const list = `
    <p>Short teaser from the feed.</p>
    <ul>
      <li><a href="https://news.example.com/a">Markets rally as inflation cools for third month</a></li>
      <li><a href="https://news.example.com/b">Storm expected to hit coast on Friday</a></li>
      <li><a href="https://news.example.com/c">City council approves new transit plan</a></li>
      <li><a href="https://news.example.com/d">What we know about the stadium deal</a></li>
      <li><a href="https://news.example.com/e">Ten photos from the harvest festival</a></li>
    </ul>`

  it('drops a list that is nothing but links, for any source', () => {
    const out = normalizeReaderContent(list)
    expect(out).toContain('Short teaser from the feed.')
    expect(out).not.toContain('news.example.com')
    expect(out).not.toMatch(/<ul/)
  })

  it('drops the heading with the list it introduces', () => {
    const out = normalizeReaderContent(`${STORY}<h2>More on this story</h2>${list}`)
    expect(out).toContain('Nearly every Democratic senator')
    expect(out).not.toMatch(/More on this story|news\.example\.com/)
  })

  it('drops "Related topics" and its link cluster even when it is not a list', () => {
    const cluster =
      '<div><a href="/t/1">Politics</a> <a href="/t/2">Middle East</a> <a href="/t/3">Congress</a> <a href="/t/4">Human rights</a> <a href="/t/5">Weapons</a></div>'
    const out = normalizeReaderContent(`${STORY}<h3>Related topics</h3>${cluster}`)
    expect(out).toContain('Nearly every Democratic senator')
    expect(out).not.toMatch(/Related topics|Congress|Human rights/)
  })

  it('drops a run of paragraphs that are each only a link', () => {
    const run = ['a', 'b', 'c', 'd', 'e']
      .map((id) => `<p><a href="https://news.example.com/${id}">Headline number ${id} of the day</a></p>`)
      .join('')
    const out = normalizeReaderContent(`${STORY}${run}`)
    expect(out).toContain('Nearly every Democratic senator')
    expect(out).not.toContain('news.example.com')
  })

  it('keeps a list with real prose in it', () => {
    const html =
      '<ul><li>The <a href="https://example.com/report">report</a> found that spending rose by nine percent over the decade.</li><li>Officials <a href="https://example.com/reply">disputed</a> the figure and said the methodology was flawed.</li><li>A second review, due in spring, will settle the question of scope.</li></ul>'
    expect(normalizeReaderContent(html)).toBe(html)
  })

  it('counts a body that was mostly a link list as thin, however long it started', () => {
    const items = Array.from(
      { length: 40 },
      (_, id) => `<li><a href="https://news.example.com/${id}">Headline number ${id} about something that happened today</a></li>`,
    ).join('')
    const html = `<p>Teaser.</p><ul>${items}</ul>`
    expect(stripTags(html).length).toBeGreaterThan(1000)
    expect(isThinAfterCleaning(html)).toBe(true)
  })
})

describe('images in the body', () => {
  it('removes share icons, logos and pixels, and the empty links around them', () => {
    const out = normalizeReaderContent(`
      <p><a href="https://facebook.com/share"><img src="https://example.com/assets/facebook.png" alt="Facebook"></a>
      <a href="https://twitter.com/share"><img src="https://example.com/assets/twitter.png" alt="Twitter"></a></p>
      <img src="https://example.com/t/pixel.gif" width="1" height="1">
      <img src="https://cdn.example.com/lazy-placeholder.jpg" width="16" height="16">
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">
      ${STORY}
      <figure><img src="https://cdn.example.com/2026/09/chamber.jpg" alt="The chamber"><figcaption>The Senate chamber.</figcaption></figure>
    `)
    expect(out).not.toMatch(/facebook|twitter|pixel|lazy-placeholder|data:image/i)
    expect(out).not.toMatch(/<a\b[^>]*>\s*<\/a>/)
    expect(out).toContain('chamber.jpg')
    expect(out).toContain('The Senate chamber.')
  })

  it('injects a lead image when the only body images were furniture', () => {
    const out = normalizeReaderContent(
      `<img src="https://example.com/assets/facebook.png">${STORY}`,
      { leadImageUrl: 'https://cdn.example.com/lead.jpg' },
    )
    expect(out).toContain('article-reader-hero')
    expect(out).toContain('https://cdn.example.com/lead.jpg')
    expect(out).not.toContain('facebook.png')
  })

  it('adds lazy loading and no-referrer, leaving the first image eager', () => {
    const out = enhanceReaderImages('<img src="https://a.test/1.jpg"><img src="https://a.test/2.jpg" loading="eager">')
    const [first, second] = out.match(/<img[^>]*>/g) || []
    expect(first).toContain('referrerpolicy="no-referrer"')
    expect(first).not.toContain('loading=')
    expect(second).toContain('loading="eager"')
    expect(enhanceReaderImages('<p>No images</p>')).toBe('<p>No images</p>')
  })
})

describe('og:image', () => {
  it('reads the publisher-chosen picture, in either attribute order, and resolves relative URLs', () => {
    expect(
      extractOpenGraphImage(
        '<head><meta property="og:image" content="https://ichef.bbci.co.uk/news/1024/story.jpg"></head>',
        'https://www.bbc.com/news/articles/abc',
      ),
    ).toBe('https://ichef.bbci.co.uk/news/1024/story.jpg')

    expect(
      extractOpenGraphImage(
        '<meta content="/media/story-hero.jpg?a=1&amp;b=2" property="og:image">',
        'https://www.example.com/news/x',
      ),
    ).toBe('https://www.example.com/media/story-hero.jpg?a=1&b=2')
  })

  it('falls through to twitter:image and refuses furniture', () => {
    expect(
      extractOpenGraphImage(
        '<meta property="og:image" content="https://www.example.com/static/logo.png"><meta name="twitter:image" content="https://cdn.example.com/photo.jpg">',
        'https://www.example.com/x',
      ),
    ).toBe('https://cdn.example.com/photo.jpg')
    expect(
      extractOpenGraphImage('<meta property="og:image" content="https://www.example.com/logo.png">', 'https://www.example.com/x'),
    ).toBeUndefined()
  })
})
