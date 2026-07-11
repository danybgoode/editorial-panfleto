const QSTASH_PUBLISH_URL = 'https://qstash.upstash.io/v2/publish'

type PublishJSONArgs = {
  body: Record<string, unknown>
  cronSecret: string
  destination: string
}

type QStashPublishResponse = {
  messageId?: string
  url: string
}

const getQStashToken = () => process.env.QSTASH_TOKEN || process.env.UPSTASH_QSTASH_TOKEN

export const publishJSONToQStash = async ({
  body,
  cronSecret,
  destination,
}: PublishJSONArgs): Promise<QStashPublishResponse> => {
  const token = getQStashToken()

  if (!token) {
    throw new Error('QSTASH_TOKEN or UPSTASH_QSTASH_TOKEN is required.')
  }

  const response = await fetch(`${QSTASH_PUBLISH_URL}/${encodeURIComponent(destination)}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Forward-Authorization': `Bearer ${cronSecret}`,
      'Upstash-Forward-Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Unable to publish QStash message: ${response.status} ${errorBody}`)
  }

  const result = (await response.json()) as { messageId?: string }

  return {
    messageId: result.messageId,
    url: destination,
  }
}
