import { fetchDevToThread, parseDevToArticlePath } from './devto'
import { fetchHackerNewsThread, getHackerNewsItemId, type HNThread } from './hackernews'
import { fetchPanfletoCommentThread } from './panfleto'

export type CommentSource = 'devto' | 'hn' | 'panfleto'

export type ArticleCommentThread = {
  commentsUrl: string
  source: CommentSource
  thread: HNThread
}

export const commentSourceLabel = (source: CommentSource, commentsUrl?: string) => {
  if (source === 'hn' || commentsUrl?.includes('news.ycombinator.com')) return 'Hacker News'
  if (source === 'devto' || commentsUrl?.includes('dev.to')) return 'DEV'
  return 'la fuente'
}

export async function fetchArticleCommentThread(
  commentsUrl?: string,
  articleUrl?: string,
): Promise<ArticleCommentThread | null> {
  const hnId = getHackerNewsItemId(commentsUrl, articleUrl)
  if (hnId) {
    const thread = await fetchHackerNewsThread(hnId)
    if (thread && thread.children.length > 0) {
      return {
        commentsUrl: commentsUrl || `https://news.ycombinator.com/item?id=${hnId}`,
        source: 'hn',
        thread,
      }
    }
  }

  for (const target of [commentsUrl, articleUrl]) {
    if (!target) continue
    if (getHackerNewsItemId(target)) continue
    const panfleto = await fetchPanfletoCommentThread(target)
    if (panfleto && panfleto.children.length > 0) {
      return { commentsUrl: target, source: 'panfleto', thread: panfleto }
    }
  }

  const devtoUrl = [commentsUrl, articleUrl].find((value) => parseDevToArticlePath(value))
  if (devtoUrl) {
    const thread = await fetchDevToThread(devtoUrl)
    if (thread && thread.children.length > 0) {
      return { commentsUrl: devtoUrl, source: 'devto', thread }
    }
  }

  return null
}
