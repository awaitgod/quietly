import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeAccountSlot, accountSessionKey, pendingAuthKey, rememberAccount, removeAccount, savedAccounts, selectAccountSlot } from '../src/services/accountStorage'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, String(value)), removeItem: (key: string) => values.delete(key) })
})

describe('saved accounts', () => {
  it('keeps sessions and unfinished sign-in state in separate slots', () => {
    const defaultSession = accountSessionKey()
    const defaultPending = pendingAuthKey()
    selectAccountSlot('slot-two')
    expect(accountSessionKey()).not.toBe(defaultSession)
    expect(pendingAuthKey()).not.toBe(defaultPending)
    expect(activeAccountSlot()).toBe('slot-two')
  })
  it('keeps profiles and removes only the chosen account', () => {
    rememberAccount({ id: 'a', name: 'Anna', username: 'anna' }, 'a@example.com')
    localStorage.setItem(accountSessionKey(), 'session-a')
    selectAccountSlot('second')
    rememberAccount({ id: 'b', name: 'Boris', username: 'boris' }, 'b@example.com')
    localStorage.setItem(accountSessionKey(), 'session-b')
    expect(savedAccounts().map(a => a.id)).toEqual(['a', 'b'])
    removeAccount('second')
    expect(savedAccounts().map(a => a.id)).toEqual(['a'])
    expect(localStorage.getItem(accountSessionKey('default'))).toBe('session-a')
    expect(localStorage.getItem(accountSessionKey('second'))).toBeNull()
  })
})
