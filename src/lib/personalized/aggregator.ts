const AGGREGATOR_HOSTS = new Set(['techmeme.com'])

const SKIP_CITED_HOST = /(?:^|\.)(techmeme\.com|twitter\.com|x\.com|bsky\.app|facebook\.com|linkedin\.com|instagram\.com|threads\.net|t\.co|bit\.ly|news\.ycombinator\.com)$/i

export const hostOf = (value?: string): string => {
  if (!value) return ''
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

export const isAggregatorUrl = (url?: string, siteUrl?: string): boolean =>
  AGGREGATOR_HOSTS.has(hostOf(url)) || AGGREGATOR_HOSTS.has(hostOf(siteUrl))

export const extractCitedArticleUrl = (
  html?: string | null,
  aggregatorHost = 'techmeme.com',
): string | undefined => {
  if (!html) return undefined

  const hrefRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = hrefRe.exec(html)) !== null) {
    const href = match[1].trim()
    if (!/^https?:\/\//i.test(href)) continue

    const host = hostOf(href)
    if (!host || host === aggregatorHost.replace(/^www\./, '')) continue
    if (SKIP_CITED_HOST.test(host)) continue

    return href
  }

  return undefined
}
