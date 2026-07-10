import { seedDemoContent } from '../../../../../scripts/seed-demo-content'

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

  if (!token || !allowedTokens.includes(token)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await seedDemoContent()

  return Response.json({
    ok: true,
    ...result,
  })
}
