const prefix = 'quietly_chat_list_v1:'

export function readChatListCache<T>(userId: string, kind: 'dialogs' | 'groups' | 'archive'): T[] | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${prefix}${userId}:${kind}`) || 'null')
    return Array.isArray(value) ? value : null
  } catch { return null }
}

export function writeChatListCache(userId: string, kind: 'dialogs' | 'groups' | 'archive', items: unknown[]) {
  try { localStorage.setItem(`${prefix}${userId}:${kind}`, JSON.stringify(items)) } catch { /* cache is optional */ }
}

export function clearChatListCache(userId: string) {
  try { for (const kind of ['dialogs', 'groups', 'archive']) localStorage.removeItem(`${prefix}${userId}:${kind}`) } catch { /* cache is optional */ }
}

export function cachedUnreadCount(userId: string): number | null {
  const dialogs = readChatListCache<{ id: string; unreadCount?: number }>(userId, 'dialogs')
  const groups = readChatListCache<{ unread_count?: number }>(userId, 'groups')
  const archived = new Set(readChatListCache<string>(userId, 'archive') || [])
  if (!dialogs && !groups) return null
  return (dialogs || []).reduce((sum, item) => sum + (archived.has(item.id) ? 0 : Number(item.unreadCount) || 0), 0)
    + (groups || []).reduce((sum, item) => sum + (Number(item.unread_count) || 0), 0)
}
