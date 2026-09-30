// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearEmbedCache,
  evaluateFramingHeaders,
  isPublicHttpUrl,
  probeEmbeddable,
} from '@/lib/personalized/embed'

const OWN = 'https://panfleto.win'
const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
})

beforeEach(() => clearEmbedCache())

describe('evaluateFramingHeaders', () => {
  it('allows a page that sets no framing policy', () => {
    expect(evaluateFramingHeaders(headers({}), OWN)).toBe('allowed')
  })

  it('blocks X-Frame-Options DENY, SAMEORIGIN and ALLOW-FROM', () => {
    for (const value of ['DENY', 'SAMEORIGIN', 'sameorigin', 'ALLOW-FROM https://panfleto.win']) {
      expect(evaluateFramingHeaders(headers({ 'x-frame-options': value }), OWN), value).toBe('blocked')
    }
  })

  it('blocks CSP frame-ancestors that do not name us', () => {
    for (const value of [
      "frame-ancestors 'none'",
      "frame-ancestors 'self'",
      "default-src 'self'; frame-ancestors 'self' https://*.example.com",
      'frame-ancestors',
    ]) {
      expect(evaluateFramingHeaders(headers({ 'content-security-policy': value }), OWN), value).toBe('blocked')
    }
  })

  it('allows CSP frame-ancestors that let us in', () => {
    for (const value of [
      'frame-ancestors *',
      'frame-ancestors https:',
      'frame-ancestors https://panfleto.win',
      'frame-ancestors https://*.win',
      "frame-ancestors 'self' https://panfleto.win",
    ]) {
      expect(evaluateFramingHeaders(headers({ 'content-security-policy': value }), OWN), value).toBe('allowed')
    }
  })

  it('ignores a CSP that says nothing about framing', () => {
    expect(
      evaluateFramingHeaders(headers({ 'content-security-policy': "default-src 'self'; img-src *" }), OWN),
    ).toBe('allowed')
  })

  it('blocks when any one of several policies refuses', () => {
    expect(
      evaluateFramingHeaders(
        headers({ 'content-security-policy': "frame-ancestors *, frame-ancestors 'none'" }),
        OWN,
      ),
    ).toBe('blocked')
  })
})

describe('isPublicHttpUrl', () => {
  it('accepts public web addresses and refuses internal ones', () => {
    expect(isPublicHttpUrl('https://www.bbc.com/news/articles/abc')).toBe(true)
    for (const url of [
      'http://localhost:3000/x',
      'https://127.0.0.1/x',
      'http://10.0.0.5/x',
      'http://192.168.1.10/x',
      'http://172.20.0.1/x',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/x',
      'https://db.internal/x',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(isPublicHttpUrl(url), url).toBe(false)
    }
  })
})

describe('probeEmbeddable', () => {
  const respond = (init: ResponseInit & { url?: string }, headersInit: Record<string, string> = {}) => {
    const response = new Response('<html></html>', { ...init, headers: headersInit })
    if (init.url) Object.defineProperty(response, 'url', { value: init.url })
    return response
  }

  it('reports allowed, and remembers it per site', async () => {
    const fetchImpl = vi.fn(async () => respond({ status: 200 }))
    const url = 'https://www.example.com/a'

    expect(await probeEmbeddable(url, { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('allowed')
    expect(await probeEmbeddable('https://www.example.com/b', { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('allowed')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reports blocked when the publisher forbids framing', async () => {
    const fetchImpl = vi.fn(async () => respond({ status: 200 }, { 'x-frame-options': 'SAMEORIGIN' }))
    expect(await probeEmbeddable('https://www.bbc.com/news/x', { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('blocked')
  })

  it('does not trust the headers of a bot wall: 403 is unknown, not blocked, and is not remembered', async () => {
    const fetchImpl = vi.fn(async () => respond({ status: 403 }, { 'x-frame-options': 'SAMEORIGIN' }))
    const url = 'https://www.walled.example/a'

    expect(await probeEmbeddable(url, { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('unknown')
    expect(await probeEmbeddable(url, { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('unknown')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports unknown when the publisher cannot be reached', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('timeout')
    })
    expect(await probeEmbeddable('https://slow.example/a', { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('unknown')
  })

  it('blocks plain http (mixed content) and internal addresses without making a request', async () => {
    const fetchImpl = vi.fn()
    expect(await probeEmbeddable('http://www.example.com/a', { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('blocked')
    expect(await probeEmbeddable('https://169.254.169.254/latest', { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('blocked')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('blocks when the page redirects to plain http', async () => {
    const fetchImpl = vi.fn(async () => respond({ status: 200, url: 'http://www.example.com/a' }))
    expect(await probeEmbeddable('https://www.example.com/a', { fetchImpl: fetchImpl as never, ownOrigin: OWN })).toBe('blocked')
  })
})
