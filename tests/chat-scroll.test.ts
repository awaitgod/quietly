import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readChatScroll, saveChatScroll } from '../src/utils/chatScroll'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
})

describe('сохранение позиции чата', () => {
  it('хранит разные позиции для чатов и аккаунтов', () => {
    saveChatScroll('one', 'dm:alice', { atBottom: false, messageId: '123', offset: -12 })
    saveChatScroll('one', 'group:alice', { atBottom: true })
    saveChatScroll('two', 'dm:alice', { atBottom: false, messageId: '456', offset: 8 })
    expect(readChatScroll('one', 'dm:alice')).toEqual({ atBottom: false, messageId: '123', offset: -12 })
    expect(readChatScroll('one', 'group:alice')).toEqual({ atBottom: true })
    expect(readChatScroll('two', 'dm:alice')).toEqual({ atBottom: false, messageId: '456', offset: 8 })
  })

  it('не ломает чат при повреждённых данных или недоступном хранилище', () => {
    localStorage.setItem('quietly_scroll:one:dm%3Aalice', '{')
    expect(readChatScroll('one', 'dm:alice')).toBeNull()
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error() }, setItem: () => { throw new Error() } })
    expect(readChatScroll('one', 'dm:alice')).toBeNull()
    expect(() => saveChatScroll('one', 'dm:alice', { atBottom: true })).not.toThrow()
  })
})
