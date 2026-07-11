type LexicalNode = {
  children?: LexicalNode[]
  text?: string
}

const collectText = (node: LexicalNode | null | undefined): string[] => {
  if (!node || typeof node !== 'object') return []

  const ownText = typeof node.text === 'string' ? [node.text] : []
  const childText = Array.isArray(node.children) ? node.children.flatMap(collectText) : []

  return [...ownText, ...childText]
}

export const lexicalToPlainText = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''

  const root = 'root' in value ? (value as { root?: LexicalNode }).root : (value as LexicalNode)

  return collectText(root).join(' ').replace(/\s+/g, ' ').trim()
}
