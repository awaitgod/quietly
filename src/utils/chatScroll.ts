export type ChatScrollPosition = { atBottom: true } | { atBottom: false; messageId: string; offset: number }

function storageKey(userId: string, conversationId: string) {
  return `quietly_scroll:${encodeURIComponent(userId)}:${encodeURIComponent(conversationId)}`
}

export function readChatScroll(userId: string, conversationId: string): ChatScrollPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId, conversationId)) || 'null')
    if (value?.atBottom === true) return { atBottom: true }
    if (value?.atBottom === false && typeof value.messageId === 'string' && value.messageId && Number.isFinite(value.offset))
      return { atBottom: false, messageId: value.messageId, offset: value.offset }
  } catch { /* недоступное или повреждённое хранилище не должно мешать чату */ }
  return null
}

export function saveChatScroll(userId: string, conversationId: string, position: ChatScrollPosition) {
  try { localStorage.setItem(storageKey(userId, conversationId), JSON.stringify(position)) }
  catch { /* чат работает и без сохранения позиции */ }
}
