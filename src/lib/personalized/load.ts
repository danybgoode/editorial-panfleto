import { loadEdition, type EditionResult, type EditionSource } from './edition'
import { fetchHackerNewsComments, fetchReaderEntriesPage, identifyReader } from './reader'
import { getUsableSessionSecret, resolvePersonalizedReader } from './resolver'
import { fingerprintKey, type ReaderSession } from './session'
import { getEditionStore, type EditionStore } from './store'

export const readerEditionSource = (token: string): EditionSource => ({
  fetchEntriesPage: (params) => fetchReaderEntriesPage(token, params),
  fetchHackerNewsComments,
  identify: () => identifyReader(token),
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
    // resolvePersonalizedReader only returns a reader when a usable secret exists.
    reader: {
      ...reader,
      keyFingerprint: fingerprintKey(reader.key, getUsableSessionSecret() || ''),
    },
    source: source ?? readerEditionSource(reader.key),
    store: store ?? getEditionStore(),
  })

  return { ...result, reader }
}
