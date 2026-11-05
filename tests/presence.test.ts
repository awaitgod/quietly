import { describe, expect, it } from 'vitest'
import { formatLastSeen, resolvePresence } from '../src/utils/presence'

describe('presence display', () => {
  const now = new Date('2026-05-16T12:00:00Z').getTime()
  it('gives precedence to bots and deleted accounts', () => {
    expect(resolvePresence({ id: 'sys:quietly', blocked: true }).text).toBe('Бот')
    expect(resolvePresence({ id: 'user', deleted: true, online: true, visible: true }).text).toBe('')
  })
  it('does not reveal an online user when access is hidden or blocked', () => {
    expect(resolvePresence({ id: 'user', visible: false, online: true })).toEqual({ text: 'Был(а) недавно', online: false })
    expect(resolvePresence({ id: 'user', visible: true, blocked: true, online: true })).toEqual({ text: 'Был(а) недавно', online: false })
  })
  it('shows presence only when visibility is allowed', () => {
    expect(resolvePresence({ id: 'user', visible: true, online: true })).toEqual({ text: 'В сети', online: true })
  })
  it('formats recent, old, missing and invalid dates', () => {
    expect(formatLastSeen('2026-05-16T11:59:30Z', now)).toBe('Был(а) только что')
    expect(formatLastSeen('2026-05-16T11:58:00Z', now)).toBe('Был(а) 2 мин. назад')
    expect(formatLastSeen('2026-05-16T10:00:00Z', now)).toBe('Был(а) 2 ч. назад')
    expect(formatLastSeen('2026-05-14T12:00:00Z', now)).toBe('Был(а) 14 мая')
    expect(formatLastSeen('invalid', now)).toBe('Был(а) недавно')
    expect(formatLastSeen(null, now)).toBe('Был(а) недавно')
  })
})
