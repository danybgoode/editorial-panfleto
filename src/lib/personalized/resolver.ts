import { openSession, type ReaderSession } from './session'

// THE resolver in front of the personalized edition (fluxonline epic personalized-edition, D7).
//
// It is the only place the enablement flag `editorial.personalized_enabled` is read. Off means every
// visitor — signed in or not — is anonymous here, so no caller can fetch a reader's feeds or write their
// cache. The flag is a server-only Vercel env var, created `false` in every environment; Vercel applies an
// env change on the next deployment, so flipping it is "set, then redeploy".

export const isPersonalizedEditionEnabled = () =>
  process.env.EDITORIAL_PERSONALIZED_ENABLED === 'true'

const getSessionSecret = () => process.env.EDITORIAL_SESSION_SECRET || ''

// A secret shorter than this is a misconfiguration, not a key: refuse to seal or open with it.
const MIN_SECRET_LENGTH = 32

export const getUsableSessionSecret = () => {
  const secret = getSessionSecret()

  return secret.length >= MIN_SECRET_LENGTH ? secret : null
}

export const resolvePersonalizedReader = (
  cookieValue: string | undefined,
  now = Date.now(),
): ReaderSession | null => {
  if (!isPersonalizedEditionEnabled()) return null

  const secret = getUsableSessionSecret()
  if (!secret) return null

  return openSession(cookieValue, secret, now)
}
