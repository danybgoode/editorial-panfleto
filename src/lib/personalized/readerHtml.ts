const ATTR_QUOTED = `"[^"]*"|'[^']*'`

const CHROME_TEXT = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (t.length > 280 && !/^you have a preview view of this article/i.test(t)) return false
  if (/^advertisement$/i.test(t)) return true
  if (/^skip advertisement$/i.test(t)) return true
  if (/^share full article$/i.test(t)) return true
  if (/^share$/i.test(t)) return true
  if (/^live updates$/i.test(t)) return true
  if (/^listen(\s*[·•.\-–—]\s*|\s+)\d+/i.test(t)) return true
  if (/^you have a preview view of this article/i.test(t)) return true
  if (/^(facebook|twitter|x|linkedin|whatsapp|email|reddit)$/i.test(t)) return true
  return false
}

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

export const firstHttpFromSrcset = (srcset: string): string | undefined => {
  for (const candidate of srcset.split(',')) {
    const url = candidate.trim().split(/\s+/)[0]
    if (/^https?:\/\//i.test(url)) return url
  }
  return undefined
}

export const extractLeadImage = (
  content?: string,
  enclosures?: Array<{ mime_type?: string; url?: string }>,
): string | undefined => {
  if (enclosures && enclosures.length > 0) {
    for (const enc of enclosures) {
      if (!enc.url) continue
      const mime = (enc.mime_type || '').toLowerCase()
      const url = enc.url.toLowerCase()
      if (
        mime.startsWith('image/') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.png') ||
        url.endsWith('.webp') ||
        url.endsWith('.avif') ||
        url.endsWith('.gif')
      ) {
        return enc.url
      }
    }
  }

  if (content) {
    const imgRegex = /<img\b[^>]*>/gi
    let match: RegExpExecArray | null
    while ((match = imgRegex.exec(content)) !== null) {
      const tagStr = match[0]
      const src =
        tagStr.match(/\bsrc=["']([^"']+)["']/i)?.[1]?.trim() ||
        tagStr.match(/\b(?:data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ||
        firstHttpFromSrcset(tagStr.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1] || '')

      if (!src || (!src.startsWith('http://') && !src.startsWith('https://'))) continue

      const lower = src.toLowerCase()
      if (
        lower.includes('1x1') ||
        lower.includes('pixel') ||
        lower.includes('tracking') ||
        lower.includes('feedsportal') ||
        lower.includes('feedburner') ||
        lower.includes('gravatar.com') ||
        lower.includes('badge') ||
        lower.includes('share-button')
      ) {
        continue
      }

      const lowerTag = tagStr.toLowerCase()
      const widthMatch = lowerTag.match(/width=["']?(\d+)["']?/)
      const heightMatch = lowerTag.match(/height=["']?(\d+)["']?/)
      if (widthMatch && parseInt(widthMatch[1], 10) <= 2) continue
      if (heightMatch && parseInt(heightMatch[1], 10) <= 2) continue

      return src
    }
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

    const lazy =
      attrs.match(/\b(?:data-src|data-lazy-src|data-original|data-image)\s*=\s*["']([^"']+)["']/i)?.[1]
    const srcset = attrs.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1]
    const promoted = (lazy && /^https?:\/\//i.test(lazy.trim()) ? lazy.trim() : undefined) ||
      (srcset ? firstHttpFromSrcset(srcset) : undefined)

    if (!promoted) return full

    if (/\bsrc\s*=/i.test(attrs)) {
      return `<img${attrs.replace(/\bsrc\s*=\s*(?:'[^']*'|"[^"]*")/i, ` src="${promoted.replace(/"/g, '&quot;')}"`)}>`
    }

    return `<img src="${promoted.replace(/"/g, '&quot;')}"${attrs}>`
  })
}

const removeMatchingTag = (html: string, tag: string): string => {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  return html.replace(re, (full, inner: string) => {
    const text = stripTags(inner)
    return CHROME_TEXT(text) ? '' : full
  })
}

export const stripReaderChrome = (
  html: string,
  { dropLinkFarms = false }: { dropLinkFarms?: boolean } = {},
): string => {
  if (!html) return ''

  let out = html
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<audio\b[^>]*\/?>/gi, '')

  for (const tag of ['aside', 'section', 'div', 'p', 'span', 'a', 'button', 'li', 'h2', 'h3', 'h4', 'em', 'strong']) {
    out = removeMatchingTag(out, tag)
  }

  out = out.replace(/you have a preview view of this article[\s\S]{0,400}?will load\.?/gi, '')

  if (dropLinkFarms) {
    out = out.replace(
      /<(ul|ol)\b[^>]*>\s*(?:<li\b[^>]*>\s*<a\b[\s\S]*?<\/a>\s*<\/li>\s*){3,}<\/\1>/gi,
      '',
    )
  }

  return out.replace(/\n{3,}/g, '\n\n')
}

export const injectLeadImage = (html: string, imageUrl?: string): string => {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return html
  if (hasUsableHttpImage(html)) return html
  const safe = imageUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return `<figure class="article-reader-hero"><img alt="" src="${safe}"></figure>${html}`
}

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

export const fetchOriginalArticleHtml = async (
  url: string,
  timeoutMs: number,
): Promise<string | undefined> => {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; PanfletoReader/1.0; +https://panfleto.win)',
      },
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
