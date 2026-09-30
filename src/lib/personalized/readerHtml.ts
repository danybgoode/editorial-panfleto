import {
  bestHttpFromSrcset,
  firstHttpFromSrcset,
  isUsableImageUrl,
  MIN_BODY_IMAGE_EDGE,
} from './images'

export { firstHttpFromSrcset }

// Turning scraped or feed HTML into something worth reading. Everything here is string-in, string-out so the
// specs can run it without a network; Miniflux has already sanitized the HTML for XSS, this is about noise.

// --- text helpers -------------------------------------------------------------------------------------------

const ATTR_QUOTED = `"[^"]*"|'[^']*'`
const MEDIA = /<(?:img|picture|video|iframe)\b/i

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const decodeBasic = (value: string) =>
  value
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")

const normalizeText = (html: string) =>
  decodeBasic(stripTags(html))
    .replace(/[\u200b\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const attrOf = (tag: string, name: string): string | undefined => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))
  return match ? (match[1] ?? match[2]) : undefined
}

// --- what counts as "not the article" -------------------------------------------------------------------------

// Whole-element matches: an element whose entire text is one of these is chrome.
const EXACT_CHROME: RegExp[] = [
  /^advertisement$/i,
  /^skip advertisement$/i,
  /^share full article$/i,
  /^share( this (article|story))?$/i,
  /^live updates$/i,
  /^listen(\s*[·•.\-–—]\s*|\s+)\d+/i,
  /^(facebook|twitter|x|linkedin|whatsapp|email|reddit|pinterest|telegram|messenger|bluesky|flipboard)$/i,
  /^(copy link|print|save|comments?|copiar enlace|imprimir|guardar|compartir|comentarios)$/i,
  /^(share|tweet|post|compartir)( (on|en|via))? (facebook|twitter|x|linkedin|whatsapp|email|reddit|pinterest|telegram|messenger|bluesky)$/i,
  /^supported by$/i,
  /^continue reading the main story$/i,
  /^skip to (main )?content$/i,
  /^(subscribe|log in|sign in|sign up|suscríbete|iniciar sesión|inicia sesión)$/i,
]

// Phrases a paywall or subscription wall injects. An element made of nothing but these (in any number, in
// any order, run together or not) is chrome. That is how the NYT block arrives: five or six sentences, in two
// languages, repeated, with no separators once the tags are gone.
const BOILERPLATE: RegExp[] = [
  /see more of our coverage in your search results\.?/gi,
  /encuentra más de nuestra cobertura en los resultados de búsqueda\.?/gi,
  /add the new york times on google/gi,
  /agrega the new york times en google/gi,
  /thank you for your patience while we verify access\.?/gi,
  /if you are in reader mode please exit and log into your times account,? or subscribe for all of the times\.?/gi,
  /already a subscriber\??\s*log in\.?/gi,
  /want all of the times\??\s*subscribe\.?/gi,
  /we are having trouble retrieving the article content\.?/gi,
  /please enable javascript in your browser settings and refresh the page to continue reading\.?/gi,
  /skip advertisement/gi,
  /advertisement/gi,
  /related content/gi,
  /supported by/gi,
]

// The distinctive ones also get removed from inside a longer text node, in case the wall's sentence sits in
// the same paragraph as real text. The short generic ones ("Related content") never do.
const INLINE_BOILERPLATE: RegExp[] = BOILERPLATE.slice(0, 9)

const PREVIEW_NOTICE = /^you have a preview view of this article/i
const PUNCTUATION_ONLY = /[\s.,;:!?·•|()\-–—]+/g

const isBoilerplateOnly = (text: string) => {
  if (text.length > 2000) return false
  let rest = text
  for (const phrase of BOILERPLATE) rest = rest.replace(phrase, ' ')
  return rest !== text && rest.replace(PUNCTUATION_ONLY, '') === ''
}

export const isChromeText = (raw: string): boolean => {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return false
  if (PREVIEW_NOTICE.test(text)) return true
  if (text.length <= 280 && EXACT_CHROME.some((pattern) => pattern.test(text))) return true
  return isBoilerplateOnly(text)
}

// Headings that introduce a block of other stories, not part of this one.
const RELATED_HEADING =
  /^(related( (content|articles?|stories|topics|coverage|links|reading|video))?|more (on this story|on this|from [\w .&'’-]{2,40}|stories|news|to read|about this)|top stories|read more|also read|you (might|may) also like|recommended( for you| reading)?|more coverage|see also|around the web|from around the web|most (read|popular|viewed)|trending|sponsored( content)?|más (sobre este tema|noticias|historias|leídas|en [\w .&'’-]{2,30})|te (puede|podría) interesar|temas relacionados|noticias relacionadas|artículos relacionados|contenido relacionado|lee (también|más)|leer más|sigue leyendo|lo más (leído|visto)|contenido patrocinado)$/i

// --- depth-aware element removal ------------------------------------------------------------------------------
//
// The old approach matched `<div>…</div>` non-greedily, which for nested divs ends at the FIRST `</div>` and
// leaves the tree unbalanced. These helpers count nesting, so removing an element removes exactly that element.

type Removal = 'keep' | 'remove' | 'remove-with-next-block'

const findClose = (html: string, tag: string, from: number) => {
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    if (match[1]) {
      depth--
      if (depth === 0) return { closeStart: match.index, end: match.index + match[0].length }
    } else if (!match[0].endsWith('/>')) {
      depth++
    }
  }
  return undefined
}

// A list, div, section or aside right after `position` (a heading's end) belongs to that heading.
const extendOverNextBlock = (html: string, position: number) => {
  const next = html.slice(position).match(/^\s*<(ul|ol|div|section|aside)\b[^>]*>/i)
  if (!next) return position
  const close = findClose(html, next[1].toLowerCase(), position + next[0].length)
  return close ? close.end : position
}

const removeElements = (html: string, tag: string, decide: (inner: string) => Removal): string => {
  const open = new RegExp(`<${tag}(?=[\\s>/])[^>]*>`, 'gi')
  let out = ''
  let cursor = 0
  let removed = false
  let match: RegExpExecArray | null

  while ((match = open.exec(html)) !== null) {
    if (match[0].endsWith('/>')) continue
    const start = match.index
    const openEnd = start + match[0].length
    const close = findClose(html, tag, openEnd)
    if (!close) continue

    const verdict = decide(html.slice(openEnd, close.closeStart))
    if (verdict === 'keep') continue

    const end = verdict === 'remove-with-next-block' ? extendOverNextBlock(html, close.end) : close.end
    out += html.slice(cursor, start)
    cursor = end
    removed = true
    open.lastIndex = end
  }

  return removed ? out + html.slice(cursor) : html
}

const chromeDecision = (inner: string): Removal => {
  if (inner.length > 6000 || MEDIA.test(inner)) return 'keep'
  return isChromeText(normalizeText(inner)) ? 'remove' : 'keep'
}

const relatedDecision = (inner: string): Removal => {
  if (inner.length > 400 || MEDIA.test(inner)) return 'keep'
  const text = normalizeText(inner).replace(/[:：]$/, '')
  return text.length > 0 && text.length <= 60 && RELATED_HEADING.test(text)
    ? 'remove-with-next-block'
    : 'keep'
}

// --- link farms -----------------------------------------------------------------------------------------------

const linkStats = (inner: string) => {
  let anchors = 0
  let linkChars = 0
  inner.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_match, body: string) => {
    anchors++
    linkChars += stripTags(body).length
    return ''
  })
  return { anchors, linkChars, total: stripTags(inner).length }
}

// A list where nearly every item is a link and nearly all of its text is link text: "More on this story",
// "Top stories", a footer of section links. A list in an article body has prose in it.
const listDecision = (inner: string): Removal => {
  if (inner.length > 20000) return 'keep'
  const items = (inner.match(/<li\b/gi) || []).length
  if (items < 3) return 'keep'
  const { anchors, linkChars, total } = linkStats(inner)
  return total > 0 && anchors >= items * 0.8 && linkChars / total >= 0.7 ? 'remove' : 'keep'
}

// The same idea for a wrapper that is mostly links without being a list (a tag cloud, a row of teasers).
const blockDecision = (inner: string): Removal => {
  if (inner.length > 20000) return 'keep'
  const { anchors, linkChars, total } = linkStats(inner)
  return anchors >= 4 && total > 0 && total <= 3000 && linkChars / total >= 0.8 ? 'remove' : 'keep'
}

// Four or more paragraphs in a row that are each nothing but one link.
const LINK_PARAGRAPH_RUN = /(?:\s*<p\b[^>]*>\s*<a\b[^>]*>[^<]{4,200}<\/a>\s*<\/p>){4,}/gi

const dropDenseLinkBlocks = (html: string): string => {
  let out = html
  for (const tag of ['ul', 'ol']) out = removeElements(out, tag, listDecision)
  for (const tag of ['div', 'section', 'aside']) out = removeElements(out, tag, blockDecision)
  return out.replace(LINK_PARAGRAPH_RUN, '')
}

// --- images ---------------------------------------------------------------------------------------------------

const CARD_SRCSET_CAP = 1280

// Every place an <img> can keep its real address, best first. The first one that is not furniture wins, so a
// 1x1 pixel in `src` does not hide the real picture in `data-src`.
const imageSourceCandidates = (tag: string): string[] => {
  const src = attrOf(tag, 'src')?.trim()
  const lazy = attrOf(tag, 'data-src') || attrOf(tag, 'data-lazy-src') || attrOf(tag, 'data-original')
  const srcset = attrOf(tag, 'srcset') || attrOf(tag, 'data-srcset')
  const fromSrcset = srcset ? bestHttpFromSrcset(srcset, { maxDescriptor: CARD_SRCSET_CAP }) : undefined

  return [fromSrcset, lazy?.trim(), src].filter(
    (candidate): candidate is string => Boolean(candidate) && /^https?:\/\//i.test(candidate!),
  )
}

const declaredEdge = (tag: string, name: 'width' | 'height') => {
  const value = Number(attrOf(tag, name))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

const isDeclaredTiny = (tag: string) => {
  const width = declaredEdge(tag, 'width')
  const height = declaredEdge(tag, 'height')
  return (
    (width !== undefined && width <= MIN_BODY_IMAGE_EDGE) ||
    (height !== undefined && height <= MIN_BODY_IMAGE_EDGE)
  )
}

export const extractLeadImage = (
  content?: string,
  enclosures?: Array<{ mime_type?: string; url?: string }>,
): string | undefined => {
  for (const enclosure of enclosures || []) {
    if (!enclosure.url || !isUsableImageUrl(enclosure.url)) continue
    const mime = (enclosure.mime_type || '').toLowerCase()
    const extension = /\.(?:jpe?g|png|webp|avif|gif)(?:[?#].*)?$/i.test(enclosure.url)
    if (mime.startsWith('image/') || extension) return enclosure.url
  }

  if (!content) return undefined

  const images = content.match(/<img\b[^>]*>/gi) || []
  for (const tag of images) {
    if (isDeclaredTiny(tag)) continue
    const usable = imageSourceCandidates(tag).find((candidate) => isUsableImageUrl(candidate))
    if (usable) return usable
  }

  return undefined
}

export const hasUsableHttpImage = (html?: string): boolean => Boolean(extractLeadImage(html))

export const promoteLazyImages = (html: string): string => {
  if (!html) return ''

  return html.replace(/<img\b([^>]*)>/gi, (full, rawAttrs: string) => {
    const attrs = rawAttrs || ''
    const existingSrc = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.trim()
    const existingIsHttp = existingSrc ? /^https?:\/\//i.test(existingSrc) : false
    const looksLikePixel =
      existingSrc &&
      (/1x1|pixel|tracking|spacer|placeholder/i.test(existingSrc) ||
        /width=["']?[12]\b/i.test(attrs))

    if (existingIsHttp && !looksLikePixel) return full

    const lazy = attrs.match(
      /\b(?:data-src|data-lazy-src|data-original|data-image)\s*=\s*["']([^"']+)["']/i,
    )?.[1]
    const srcset = attrs.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1]
    const promoted =
      (lazy && /^https?:\/\//i.test(lazy.trim()) ? lazy.trim() : undefined) ||
      (srcset ? bestHttpFromSrcset(srcset, { maxDescriptor: CARD_SRCSET_CAP }) : undefined)

    if (!promoted) return full

    if (/\bsrc\s*=/i.test(attrs)) {
      return `<img${attrs.replace(/\bsrc\s*=\s*(?:'[^']*'|"[^"]*")/i, ` src="${promoted.replace(/"/g, '&quot;')}"`)}>`
    }

    return `<img src="${promoted.replace(/"/g, '&quot;')}"${attrs}>`
  })
}

// Share icons, logos, avatars, tracking pixels and lazy-load placeholders are not part of a story.
export const removeJunkImages = (html: string): string =>
  html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (isDeclaredTiny(tag)) return ''

    const src = attrOf(tag, 'src')?.trim()
    if (!src) return tag
    if (/^https?:\/\//i.test(src)) return isUsableImageUrl(src) ? tag : ''
    // A tiny inline `data:` image is a lazy-loading placeholder that never got swapped.
    if (/^data:/i.test(src) && src.length < 400) return ''
    return tag
  })

// Lazy loading and no-referrer for the body's images: below-the-fold pictures wait, and publishers that
// refuse hotlinks with a foreign Referer serve them anyway. The first image stays eager (it is the hero).
export const enhanceReaderImages = (html: string): string => {
  let first = true
  return html.replace(/<img\b([^>]*?)(\/?)>/gi, (full, attrs: string, slash: string) => {
    let extra = ''
    if (!/\bdecoding\s*=/i.test(attrs)) extra += ' decoding="async"'
    if (!/\breferrerpolicy\s*=/i.test(attrs)) extra += ' referrerpolicy="no-referrer"'
    if (!first && !/\bloading\s*=/i.test(attrs)) extra += ' loading="lazy"'
    first = false
    return extra ? `<img${attrs}${extra}${slash}>` : full
  })
}

// --- the cleaning pass ----------------------------------------------------------------------------------------

const CHROME_TAGS = [
  'aside',
  'section',
  'div',
  'p',
  'span',
  'a',
  'button',
  'li',
  'h2',
  'h3',
  'h4',
  'em',
  'strong',
]

const RELATED_TAGS = ['h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div']

// Elements the passes above emptied out (a share `<li>` whose link was removed, an `<a>` around a removed logo).
const EMPTY_ELEMENT =
  /<(a|p|span|div|li|ul|ol|section|aside|figure|figcaption|h[2-6]|em|strong|b|i|button)\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi

const removeEmptyElements = (html: string): string => {
  let out = html
  for (let pass = 0; pass < 6; pass++) {
    const next = out.replace(EMPTY_ELEMENT, '')
    if (next === out) break
    out = next
  }
  return out
}

const scrubInlineBoilerplate = (html: string): string =>
  html.replace(/>([^<>]+)</g, (match, text: string) => {
    let cleaned = text
    for (const phrase of INLINE_BOILERPLATE) cleaned = cleaned.replace(phrase, '')
    return cleaned === text ? match : `>${cleaned}<`
  })

export const stripReaderChrome = (
  html: string,
  { dropLinkFarms = false }: { dropLinkFarms?: boolean } = {},
): string => {
  if (!html) return ''

  let out = html
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<audio\b[^>]*\/?>/gi, '')
    // Inline SVG in scraped pages is share-button and UI iconography.
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')

  out = removeJunkImages(out)

  // Related-story headings go first, so "Related content" takes its list of links with it instead of being
  // caught later as a lone piece of chrome and leaving the list behind.
  for (const tag of RELATED_TAGS) out = removeElements(out, tag, relatedDecision)

  for (const tag of CHROME_TAGS) out = removeElements(out, tag, chromeDecision)

  out = scrubInlineBoilerplate(out)
  out = out.replace(/you have a preview view of this article[\s\S]{0,400}?will load\.?/gi, '')

  if (dropLinkFarms) {
    out = out.replace(
      /<(ul|ol)\b[^>]*>\s*(?:<li\b[^>]*>\s*<a\b[\s\S]*?<\/a>\s*<\/li>\s*){3,}<\/\1>/gi,
      '',
    )
  }
  out = dropDenseLinkBlocks(out)

  return removeEmptyElements(out).replace(/\n{3,}/g, '\n\n')
}

export const injectLeadImage = (html: string, imageUrl?: string): string => {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return html
  if (hasUsableHttpImage(html)) return html
  const safe = imageUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return `<figure class="article-reader-hero"><img alt="" src="${safe}"></figure>${html}`
}

// --- fetching the source page ---------------------------------------------------------------------------------

export const extractReadableArticleHtml = (pageHtml: string): string => {
  const withoutChrome = pageHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')

  const article = withoutChrome.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  if (article?.[1] && stripTags(article[1]).length > 200) return article[1]

  const main = withoutChrome.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  if (main?.[1] && stripTags(main[1]).length > 200) return main[1]

  const body = withoutChrome.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return body?.[1] || withoutChrome
}

const SOURCE_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'User-Agent': 'Mozilla/5.0 (compatible; PanfletoReader/1.0; +https://panfleto.win)',
}

export const fetchOriginalArticleHtml = async (
  url: string,
  timeoutMs: number,
): Promise<string | undefined> => {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: SOURCE_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return undefined
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('html') && contentType.length > 0) return undefined
    const page = await response.text()
    if (!page) return undefined
    return extractReadableArticleHtml(page)
  } catch {
    return undefined
  }
}

const HEAD_BYTES = 256 * 1024

// Reads only as much of a page as its <head> needs: the meta tags live there, the rest is megabytes of markup.
const readHead = async (response: Response): Promise<string> => {
  if (!response.body) return response.text()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0

  try {
    while (bytes < HEAD_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      text += decoder.decode(value, { stream: true })
      if (/<\/head>/i.test(text)) break
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  return text
}

const metaContent = (head: string, key: string): string | undefined => {
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const name = (attrOf(tag, 'property') || attrOf(tag, 'name') || '').toLowerCase()
    if (name === key) return attrOf(tag, 'content')?.trim() || undefined
  }
  return undefined
}

// The picture the publisher itself chose to represent the story (og:image). It is a better answer than
// scanning the body for whichever <img> comes first, and the only answer when the feed carried no body.
export const extractOpenGraphImage = (head: string, pageUrl: string): string | undefined => {
  for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    const raw = metaContent(head, key)
    if (!raw) continue
    try {
      const resolved = new URL(raw.replace(/&amp;/g, '&'), pageUrl).toString()
      if (isUsableImageUrl(resolved)) return resolved
    } catch {
      // A malformed URL is the same as no URL; try the next tag.
    }
  }
  return undefined
}

export const fetchOpenGraphImage = async (
  url: string,
  timeoutMs: number,
): Promise<string | undefined> => {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: SOURCE_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return undefined
    const head = await readHead(response)
    return extractOpenGraphImage(head, response.url || url)
  } catch {
    return undefined
  }
}

export const normalizeLayoutAttributes = (html: string): string => {
  if (!html) return ''

  let out = html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(new RegExp(`\\sstyle\\s*=\\s*(${ATTR_QUOTED})`, 'gi'), '')

  out = out.replace(/<([a-z][\w:-]*)(\s[^>]*)?>/gi, (match, tag: string, attrs?: string) => {
    if (!attrs) return match
    if (tag.toLowerCase() === 'img') return match
    const cleaned = attrs.replace(
      new RegExp(`\\s(?:width|height)\\s*=\\s*(${ATTR_QUOTED}|[^\\s>]+)`, 'gi'),
      '',
    )
    return `<${tag}${cleaned}>`
  })

  return out
}
