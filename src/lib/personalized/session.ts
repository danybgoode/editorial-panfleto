import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// The reader's session for the personalized edition (fluxonline epic personalized-edition, D4).
//
// The cookie holds the reader's own panfleto API key, sealed with AES-256-GCM under a server-only secret.
// The browser carries ciphertext it cannot read or alter: a flipped bit fails the GCM tag, so the user ID
// inside can be trusted as the one /v1/me returned at connect time. Nothing is stored server-side.

export const SESSION_COOKIE = 'panfleto_edicion'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

// Miniflux mints 64 hex characters. Anything that cannot be a token is refused before it reaches fetch —
// in particular CR/LF, which Node would quote back verbatim in a rejected-header exception.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export const isPlausibleToken = (value: string) => TOKEN_PATTERN.test(value)

export type ReaderSession = {
  issuedAt: number
  key: string
  userId: number
  username: string
}

const VERSION = 'v1'

const deriveKey = (secret: string) =>
  createHash('sha256').update(`panfleto-edicion:${secret}`).digest()

export const sealSession = (session: ReaderSession, secret: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const body = Buffer.concat([
    cipher.update(
      JSON.stringify({
        i: session.issuedAt,
        k: session.key,
        n: session.username,
        u: session.userId,
      }),
      'utf8',
    ),
    cipher.final(),
  ])

  return [VERSION, iv, body, cipher.getAuthTag()]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.')
}

export const openSession = (
  value: string | undefined,
  secret: string,
  now = Date.now(),
): ReaderSession | null => {
  if (!value || !secret) return null

  const [version, iv, body, tag, extra] = value.split('.')
  if (version !== VERSION || !iv || !body || !tag || extra !== undefined) return null

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey(secret),
      Buffer.from(iv, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const plain = Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()])
    const data = JSON.parse(plain.toString('utf8')) as {
      i: unknown
      k: unknown
      n: unknown
      u: unknown
    }

    if (
      typeof data.i !== 'number' ||
      typeof data.k !== 'string' ||
      typeof data.n !== 'string' ||
      typeof data.u !== 'number' ||
      !isPlausibleToken(data.k)
    ) {
      return null
    }

    if (now - data.i > SESSION_MAX_AGE_SECONDS * 1000 || data.i > now + 60_000) return null

    return { issuedAt: data.i, key: data.k, userId: data.u, username: data.n }
  } catch {
    return null
  }
}
