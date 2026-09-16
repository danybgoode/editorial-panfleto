import { loadEdition, type EditionResult, type EditionSource } from './edition'
import { fetchHackerNewsComments, fetchReaderEntriesPage } from './reader'
import { resolvePersonalizedReader } from './resolver'
import type { ReaderSession } from './session'
import { getEditionStore, type EditionStore } from './store'

export const readerEditionSource = (token: string): EditionSource => ({
  fetchEntriesPage: (params) => fetchReaderEntriesPage(token, params),
  fetchHackerNewsComments,
})

// Everything the personalized page needs, behind the one resolver: with the flag off, or no valid session,
// this returns null before any fetch or cache read or write happens.
export const loadPersonalizedEdition = async (
  cookieValue: string | undefined,
  {
    now = Date.now(),
    source,
    store,
  }: { now?: number; source?: EditionSource; store?: EditionStore } = {},
): Promise<(EditionResult & { reader: ReaderSession }) | null> => {
  const reader = resolvePersonalizedReader(cookieValue, now)
  if (!reader) return null

  const result = await loadEdition({
    now,
    reader,
    source: source ?? readerEditionSource(reader.key),
    store: store ?? getEditionStore(),
  })

  return { ...result, reader }
}
