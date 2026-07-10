import { seedDemoContent } from '../../../../../scripts/seed-demo-content'
import crypto from 'node:crypto'

const oneTimeSeedTokenHash =
  'b8fd67cb7aac63921770f4f999c042cd3564f014b8c2fd974562a2bc76a3268e'

const getToken = (request: Request) => {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length)

  return request.headers.get('x-seed-token')
}

export async function POST(request: Request) {
  const token = getToken(request)
  const allowedTokens = [
    process.env.CRON_SECRET,
    process.env.PREVIEW_SECRET,
    process.env.PAYLOAD_SECRET,
  ].filter((value): value is string => Boolean(value))

  const tokenHash = token ? crypto.createHash('sha256').update(token).digest('hex') : ''

  if (!token || (!allowedTokens.includes(token) && tokenHash !== oneTimeSeedTokenHash)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await seedDemoContent()

    return Response.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return Response.json({ error: message }, { status: 500 })
  }
}
