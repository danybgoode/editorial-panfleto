/**
 * Processes media resource URL to ensure proper formatting
 * @param url The original URL from the resource
 * @param cacheTag Optional cache tag to append to the URL
 * @returns Properly formatted URL with cache tag if provided
 *
 * Local paths (e.g. `/api/media/file/image.webp`) are kept relative so
 * Next.js image optimization treats them as local rather than fetching
 * through `remotePatterns`, which blocks private IPs since Next.js 16.
 */
export const getMediaUrl = (
  url: string | null | undefined,
  cacheTag?: string | null,
  filename?: string | null,
): string => {
  if (!url) return ''

  if (cacheTag && cacheTag !== '') {
    cacheTag = encodeURIComponent(cacheTag)
  }

  const src =
    process.env.NEXT_PUBLIC_MEDIA_DELIVERY === 'payload' && filename
      ? `/api/media/file/${encodeURIComponent(filename)}`
      : url

  return cacheTag ? `${src}?${cacheTag}` : src
}
