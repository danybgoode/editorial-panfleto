// v1 ranking for the personalized edition — a port of the spike's rank.py, as the product owner read it
// (fluxonline spike-personalized-editorial D3; personalized-edition D8). Tuning is wave 3, not this file:
// if the page reads wrong, write it down for `editorial-ranking-tuning` instead of changing a number here.
//
// Pure and import-free on purpose, so the specs load it without Next or Payload.

export type SlimEntry = {
  categoryTitle: string
  commentsUrl: string
  contentLength: number
  excerpt: string
  feedId: number
  feedTitle: string
  id: number
  imageUrl?: string
  publishedAt: string
  readingTime: number
  siteUrl: string
  title: string
  url: string
}

export type EditionStory = {
  category: string
  comments: number
  commentsUrl: string
  excerpt: string
  feedTitle: string
  id?: number
  imageUrl?: string
  publishedAt: string
  readingTime: number
  score: number
  // Publishers, not feeds: two BBC feeds are one source.
  sources: string[]
  title: string
  url: string
}

export type Edition = {
  clusterCount: number
  entryCount: number
  front: EditionStory[]
  generatedAt: string
  sections: Array<{ category: string; stories: EditionStory[] }>
  storyCount: number
}

export const HALF_LIFE_HOURS = 6
export const FRONT_SIZE = 7
export const FRONT_FEED_CAP = 1
export const FRONT_CATEGORY_CAP = 3
export const SECTION_COUNT = 5
export const SECTION_SIZE = 6
export const SECTION_FEED_CAP = 2
const EXCERPT_LENGTH = 220

const STOP = new Set(
  'the a an of to in on for and or with at by from as is are was be it its this that after over new says say will how why what who de la el los las en y a del que un una por con para se su al es lo más sobre como tras'.split(
    ' ',
  ),
)

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’',
}

export const decodeEntities = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X'
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    }
    const named = name.toLowerCase()
    return Object.hasOwn(NAMED_ENTITIES, named) ? NAMED_ENTITIES[named] : match
  })

export const titleTokens = (title: string) => {
  const folded = decodeEntities(title).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
  return new Set(
    (folded.match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !STOP.has(word)),
  )
}

export const canonicalURL = (url: string) =>
  url
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase()

export const makeExcerpt = (html: string) => {
  const text = decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= EXCERPT_LENGTH) return text
  const cut = text.slice(0, EXCERPT_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}

const TWO_LEVEL_SUFFIXES = new Set([
  'ac.uk',
  'co.jp',
  'co.nz',
  'co.uk',
  'com.ar',
  'com.au',
  'com.br',
  'com.co',
  'com.mx',
  'com.pe',
  'com.ve',
  'gob.mx',
  'gov.uk',
  'org.mx',
  'org.uk',
])

const PUBLISHER_ALIASES: Record<string, string> = {
  'bbc.co.uk': 'BBC',
  'bbc.com': 'BBC',
  'bbci.co.uk': 'BBC',
  'nytimes.com': 'NYT',
}

// The spike counted a publisher as the site's host with its BBC/NYT aliases. Reducing the host to its
// registrable domain is the same rule with fewer aliases to keep: rss.nytimes.com and nytimes.com are one
// newsroom.
export const publisherOf = (entry: Pick<SlimEntry, 'siteUrl'>) => {
  const host = (entry.siteUrl.match(/^[a-z]+:\/\/([^/?#:]+)/i)?.[1] || entry.siteUrl)
    .toLowerCase()
    .replace(/^www\./, '')
  const labels = host.split('.')
  const lastTwo = labels.slice(-2).join('.')
  const domain = TWO_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
  return PUBLISHER_ALIASES[domain] || domain
}

export const hackerNewsItemId = (commentsUrl: string) => {
  const match = commentsUrl.match(/^https?:\/\/news\.ycombinator\.com\/item\?id=(\d+)/)
  return match ? match[1] : null
}

type Story = EditionStory & { leadFeedTitle: string }

// A future date (a publisher's clock ahead) counts as brand new rather than scoring above 1, and an unparseable
// one as infinitely old, so neither can pin a story to the top of the page.
const ageHours = (publishedAt: string, now: number) => {
  const published = new Date(publishedAt).getTime()
  return Number.isNaN(published) ? Infinity : Math.max(0, (now - published) / 3_600_000)
}

// Cross-source dedupe: entries from DIFFERENT feeds join on the same canonical URL, or on titles sharing at
// least three tokens with Jaccard >= .5. Same-feed entries join only on URL. Candidate pairs come from an
// inverted index rather than all n² pairs; the joined groups are identical, because a pair sharing fewer
// than three tokens and no URL can never join.
const clusterEntries = (entries: SlimEntry[]) => {
  const parent = entries.map((_, index) => index)
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }

  const tokens = entries.map((entry) => titleTokens(entry.title))
  const urls = entries.map((entry) => canonicalURL(entry.url))

  const byURL = new Map<string, number[]>()
  urls.forEach((url, index) => byURL.set(url, [...(byURL.get(url) || []), index]))
  for (const members of byURL.values()) {
    for (let k = 1; k < members.length; k++) union(members[0], members[k])
  }

  const postings = new Map<string, number[]>()
  tokens.forEach((set, index) => {
    for (const token of set) postings.set(token, [...(postings.get(token) || []), index])
  })

  for (let i = 0; i < entries.length; i++) {
    const shared = new Map<number, number>()
    for (const token of tokens[i]) {
      for (const j of postings.get(token) || []) {
        if (j > i) shared.set(j, (shared.get(j) || 0) + 1)
      }
    }
    for (const [j, intersection] of shared) {
      if (intersection < 3 || entries[i].feedId === entries[j].feedId) continue
      const unionSize = tokens[i].size + tokens[j].size - intersection
      if (intersection / unionSize >= 0.5) union(i, j)
    }
  }

  const groups = new Map<number, SlimEntry[]>()
  entries.forEach((entry, index) => {
    const root = find(index)
    groups.set(root, [...(groups.get(root) || []), entry])
  })
  return [...groups.values()]
}

export const rankEdition = ({
  entries,
  hnComments,
  now,
}: {
  entries: SlimEntry[]
  hnComments: Record<string, number>
  now: number
}): Edition => {
  const stories: Story[] = clusterEntries(entries).map((group) => {
    const publishers = [...new Set(group.map(publisherOf))].sort()
    const comments = Math.max(...group.map((entry) => hnComments[String(entry.id)] || 0))
    const recency = Math.max(
      ...group.map((entry) => 0.5 ** (ageHours(entry.publishedAt, now) / HALF_LIFE_HOURS)),
    )
    const commentWeight = 1 + Math.log10(1 + comments) / 2
    const corroboration = 1 + 0.5 * (publishers.length - 1)
    // The lead copy is the longest text, then the youngest.
    const lead = group.reduce((best, entry) =>
      entry.contentLength > best.contentLength ||
      (entry.contentLength === best.contentLength &&
        ageHours(entry.publishedAt, now) < ageHours(best.publishedAt, now))
        ? entry
        : best,
    )
    const imageUrl = lead.imageUrl || group.find((e) => Boolean(e.imageUrl))?.imageUrl

    return {
      category: lead.categoryTitle,
      comments,
      commentsUrl: lead.commentsUrl,
      excerpt: lead.excerpt,
      feedTitle: lead.feedTitle,
      id: lead.id,
      imageUrl,
      leadFeedTitle: lead.feedTitle,
      publishedAt: lead.publishedAt,
      readingTime: lead.readingTime,
      score: recency * commentWeight * corroboration,
      sources: publishers,
      title: decodeEntities(lead.title),
      url: lead.url,
    }
  })

  stories.sort((a, b) => b.score - a.score)

  const used = new Set<Story>()
  const take = (pool: Story[], size: number, feedCap: number, categoryCap?: number) => {
    const out: Story[] = []
    const perFeed = new Map<string, number>()
    const perCategory = new Map<string, number>()
    for (const story of pool) {
      if (used.has(story)) continue
      if ((perFeed.get(story.leadFeedTitle) || 0) >= feedCap) continue
      if (categoryCap && (perCategory.get(story.category) || 0) >= categoryCap) continue
      out.push(story)
      used.add(story)
      perFeed.set(story.leadFeedTitle, (perFeed.get(story.leadFeedTitle) || 0) + 1)
      perCategory.set(story.category, (perCategory.get(story.category) || 0) + 1)
      if (out.length === size) break
    }
    return out
  }

  const front = take(stories, FRONT_SIZE, FRONT_FEED_CAP, FRONT_CATEGORY_CAP)

  // The spike named one reader's five categories by hand; the general form is the reader's own categories,
  // busiest first.
  const categoryCounts = new Map<string, number>()
  for (const story of stories)
    categoryCounts.set(story.category, (categoryCounts.get(story.category) || 0) + 1)
  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category)

  const sections = categories
    .map((category) => ({
      category,
      stories: take(
        stories.filter((story) => story.category === category),
        SECTION_SIZE,
        SECTION_FEED_CAP,
      ),
    }))
    .filter((section) => section.stories.length > 0)

  const strip = ({ leadFeedTitle: _lead, ...story }: Story): EditionStory => story

  return {
    clusterCount: stories.filter((story) => story.sources.length > 1).length,
    entryCount: entries.length,
    front: front.map(strip),
    generatedAt: new Date(now).toISOString(),
    sections: sections.map((section) => ({ ...section, stories: section.stories.map(strip) })),
    storyCount: stories.length,
  }
}
