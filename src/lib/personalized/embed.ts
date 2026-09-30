// Can this article be shown inside an <iframe> on our own pages?
//
// A browser decides that from the response headers of the framed page, and most large publishers say no
// (`X-Frame-Options`, or CSP `frame-ancestors`). A blocked frame renders as a blank or "refused to connect"
// box and the page can't detect it (there is no load or error event for it), so the answer has to come from
// asking the publisher first. The embed is only offered when the answer isn't a clear "no".

export type EmbedVerdict = 'allowed' | 'blocked' | 'unknown'

type HeaderReader = { get: (name: string) => null | string }

// Hostnames a server-side fetch must never be pointed at. Feed URLs are third-party input.
const PRIVATE_HOST =
  /^(?:localhost|.*\.local|.*\.internal|.*\.localdomain|metadata\.google\.internal)$/i
const PRIVATE_IPV4 =
  /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/

export const isPublicHttpUrl = (value: string): boolean => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host || PRIVATE_HOST.test(host) || PRIVATE_IPV4.test(host)) return false
  // IPv6 literals: loopback, unique-local, link-local. Public sites are not linked by IPv6 literal.
  if (host.includes(':')) return false
  return true
}

const hostMatches = (source: string, ownHost: string): boolean => {
  const pattern = source.replace(/^https?:\/\//i, '').replace(/[:/].*$/, '')
  if (pattern === ownHost) return true
  if (pattern.startsWith('*.')) return ownHost.endsWith(pattern.slice(1))
  return false
}

// One `frame-ancestors` source list, against our own origin.
const ancestorsAllow = (sources: string[], ownOrigin: string): boolean => {
  const ownHost = new URL(ownOrigin).hostname.toLowerCase()
  const ownProtocol = new URL(ownOrigin).protocol

  return sources.some((raw) => {
    const source = raw.toLowerCase()
    if (source === '*') return true
    // A bare scheme source (`https:`) allows every host on that scheme.
    if (source === ownProtocol) return true
    if (source === "'none'" || source === "'self'") return false
    return hostMatches(source, ownHost)
  })
}

// Pure so the spec can feed it headers directly.
export const evaluateFramingHeaders = (
  headers: HeaderReader,
  ownOrigin: string,
): Exclude<EmbedVerdict, 'unknown'> => {
  const frameOptions = (headers.get('x-frame-options') || '').toLowerCase()
  // DENY and SAMEORIGIN both exclude us; ALLOW-FROM is obsolete and browsers ignore it, which for a modern
  // browser means "no such permission".
  if (/deny|sameorigin|allow-from/.test(frameOptions)) return 'blocked'

  const csp = headers.get('content-security-policy') || ''
  // A header can carry several comma-separated policies; every one that names frame-ancestors must let us in.
  for (const policy of csp.split(',')) {
    const directive = policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => /^frame-ancestors(\s|$)/i.test(part))
    if (!directive) continue

    const sources = directive.split(/\s+/).slice(1)
    if (sources.length === 0 || !ancestorsAllow(sources, ownOrigin)) return 'blocked'
  }

  return 'allowed'
}

const PROBE_TIMEOUT_MS = 3500
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

// Framing policy is set per site, not per story, so one answer per origin is reused for a few hours. This
// lives in the server instance's memory: a cold instance just asks again.
const cache = new Map<string, { expires: number; verdict: EmbedVerdict }>()

export const clearEmbedCache = () => cache.clear()

export const probeEmbeddable = async (
  articleUrl: string,
  {
    fetchImpl = fetch,
    now = Date.now(),
    ownOrigin,
    timeoutMs = PROBE_TIMEOUT_MS,
  }: {
    fetchImpl?: typeof fetch
    now?: number
    ownOrigin: string
    timeoutMs?: number
  },
): Promise<EmbedVerdict> => {
  if (!isPublicHttpUrl(articleUrl)) return 'blocked'
  // An http page inside our https page is blocked by the browser as mixed content.
  if (!articleUrl.toLowerCase().startsWith('https://')) return 'blocked'

  const origin = new URL(articleUrl).origin
  const cached = cache.get(origin)
  if (cached && cached.expires > now) return cached.verdict

  let verdict: EmbedVerdict = 'unknown'
  try {
    const response = await fetchImpl(articleUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; PanfletoReader/1.0; +https://panfleto.win)',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    // We only wanted the headers.
    await response.body?.cancel().catch(() => undefined)

    if (response.url && !response.url.toLowerCase().startsWith('https://')) {
      verdict = 'blocked'
    } else if (!response.ok) {
      // A 403 from a bot wall answers with the wall's own headers (Cloudflare's carry SAMEORIGIN), which say
      // nothing about what the reader's browser would get. Don't guess from them.
      verdict = 'unknown'
    } else {
      verdict = evaluateFramingHeaders(response.headers, ownOrigin)
    }
  } catch {
    verdict = 'unknown'
  }

  // Failures aren't remembered: the next view gets to try again.
  if (verdict !== 'unknown') {
    if (cache.size >= CACHE_MAX_ENTRIES) cache.clear()
    cache.set(origin, { expires: now + CACHE_TTL_MS, verdict })
  }

  return verdict
}
