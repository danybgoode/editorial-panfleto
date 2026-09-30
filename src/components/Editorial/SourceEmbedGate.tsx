import { headers } from 'next/headers'
import React from 'react'

import { probeEmbeddable } from '@/lib/personalized/embed'
import { getServerSideURL } from '@/utilities/getURL'

import { SourceEmbed } from './SourceEmbed'

// Asks the publisher whether its page may be framed, then renders the panel. Meant to sit inside <Suspense>
// with the panel's "pending" state as the fallback, so the answer (up to a few seconds when a publisher is
// slow) never holds up the article text above it.

const ownOrigin = async () => {
  // The host this request arrived on: a publisher's frame-ancestors allow-list is checked against it, and
  // this site answers on more than one host (production, Vercel previews).
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
  if (!host) return getServerSideURL()
  const protocol = requestHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}

export async function SourceEmbedGate({ sourceLabel, url }: { sourceLabel: string; url: string }) {
  const verdict = await probeEmbeddable(url, { ownOrigin: await ownOrigin() })
  return <SourceEmbed sourceLabel={sourceLabel} url={url} verdict={verdict} />
}
