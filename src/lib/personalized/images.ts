// Pure image helpers for the personalized edition. No imports on purpose: the reader pipeline (server) and
// the card components (client) both use them, and the specs load them without Next or Payload.
//
// Feeds and scraped pages hand us all kinds of "images": share-button icons, site logos, avatars, tracking
// pixels, thumbnails a few dozen pixels wide. None of them belong on a story card or in an article body, so
// the rule here is: an image is only used when we have no reason to think it is furniture.

// Below this many natural pixels wide, an image looks blurry once a card stretches it.
export const MIN_CARD_IMAGE_WIDTH = 240
// Below this on either edge, an image inside an article is an icon or a tracking pixel, not an illustration.
export const MIN_BODY_IMAGE_EDGE = 48
// A size written in the URL itself (…-150x150.jpg, ?w=96) under this is a thumbnail, whatever the page says.
const MIN_URL_HINT_EDGE = 160

// Words that mean "this is site furniture" wherever they appear in the path.
const FURNITURE_WORDS = new Set(
  (
    'logo logos icon icons sprite sprites avatar avatars favicon badge badges spacer pixel tracking ' +
    'tracker beacon emoji smiley gravatar'
  ).split(' '),
)

// Platform and share words are furniture when the file is named for them (facebook.png, fb-share-icon.png),
// but a photo can legitimately be called "facebook-hearing-senate.jpg", so they only count in short names.
const PLATFORM_WORDS = new Set(
  (
    'facebook fb twitter tweet linkedin whatsapp pinterest reddit telegram messenger instagram tiktok ' +
    'mastodon bluesky flipboard share sharing social follow'
  ).split(' '),
)
const SHORT_FILENAME_TOKENS = 4

// Hosts that only ever serve tracking or UI assets.
const FURNITURE_HOST =
  /(?:^|\.)(?:doubleclick\.net|googletagmanager\.com|google-analytics\.com|scorecardresearch\.com|quantserve\.com|adsrvr\.org|facebook\.com|facebook\.net|static\.xx\.fbcdn\.net|abs\.twimg\.com|platform\.twitter\.com|gravatar\.com|feedburner\.com|feedsportal\.com)$/i

// Photographs are never these; logos and icons very often are.
const FURNITURE_EXTENSION = /\.(?:svg|ico|cur)$/i

const tokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// The edge length a URL claims for itself, if it says so: WordPress `-150x150.jpg`, a `?w=96` / `?width=96`
// resize parameter. Undefined when the URL says nothing.
export const imageSizeHint = (url: string): number | undefined => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }

  const hints: number[] = []

  const wordpress = parsed.pathname.match(/-(\d{2,4})x(\d{2,4})\.[a-z]{3,4}$/i)
  if (wordpress) hints.push(Math.max(Number(wordpress[1]), Number(wordpress[2])))

  for (const key of ['w', 'width']) {
    const value = Number(parsed.searchParams.get(key))
    if (Number.isFinite(value) && value > 0) hints.push(value)
  }

  return hints.length > 0 ? Math.max(...hints) : undefined
}

export const isUsableImageUrl = (url?: string | null): url is string => {
  if (!url || !/^https?:\/\//i.test(url)) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (FURNITURE_HOST.test(parsed.hostname)) return false

  const path = safeDecode(parsed.pathname)
  if (FURNITURE_EXTENSION.test(path)) return false
  if (/(?:^|[^0-9])1x1(?:[^0-9]|$)/i.test(path)) return false

  const segments = path.split('/').filter(Boolean)
  if (segments.some((segment) => tokens(segment).some((word) => FURNITURE_WORDS.has(word)))) {
    return false
  }

  const filename = tokens((segments.at(-1) || '').replace(/\.[a-z0-9]{2,5}$/i, ''))
  if (
    filename.length <= SHORT_FILENAME_TOKENS &&
    filename.some((word) => PLATFORM_WORDS.has(word))
  ) {
    return false
  }

  const hint = imageSizeHint(url)
  if (hint !== undefined && hint < MIN_URL_HINT_EDGE) return false

  return true
}

type SrcsetCandidate = { descriptor: number; url: string }

// A srcset lists the same picture at several sizes, usually smallest first. Taking the first entry (as this
// used to) hands cards the thumbnail; take the widest instead, but not a 3000px original for a card:
// `maxDescriptor` caps it, falling back to the smallest entry above the cap when nothing fits under it.
export const bestHttpFromSrcset = (
  srcset: string,
  { maxDescriptor = Infinity }: { maxDescriptor?: number } = {},
): string | undefined => {
  const candidates: SrcsetCandidate[] = []

  // Comma + whitespace is the separator; a comma inside a URL (`w_300,h_200`) is not.
  for (const part of srcset.split(/,\s+/)) {
    const [url, descriptor] = part.trim().split(/\s+/)
    if (!url || !/^https?:\/\//i.test(url)) continue
    const value = descriptor ? parseFloat(descriptor) : 1
    // `2x` descriptors and `800w` descriptors are not comparable, but a srcset never mixes them.
    candidates.push({ descriptor: Number.isFinite(value) ? value : 1, url })
  }

  if (candidates.length === 0) return undefined

  const fitting = candidates.filter((candidate) => candidate.descriptor <= maxDescriptor)
  if (fitting.length > 0) {
    return fitting.reduce((best, next) => (next.descriptor > best.descriptor ? next : best)).url
  }
  return candidates.reduce((best, next) => (next.descriptor < best.descriptor ? next : best)).url
}

// Kept for callers that only want "any http URL from this srcset".
export const firstHttpFromSrcset = bestHttpFromSrcset

// A small, stable number for a string. Placeholders are picked from it, so a story keeps the same
// placeholder on every render (a random pick per render would flicker and break hydration).
export const hashSeed = (seed: string): number => {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
