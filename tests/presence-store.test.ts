import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mock = vi.hoisted(() => ({
  auth: { authScreen: 'logged_in', profile: { online_visibility: 'all' }, user: { id: 'me' } },
  contacts: { blockedIds: new Set<string>() },
  profile: { last_seen: '2026-05-16T11:58:00Z', online_visibility: 'contacts', deleted_at: null },
  inContacts: vi.fn(), blocked: vi.fn(), update: vi.fn(), remove: vi.fn(), channels: [] as any[],
}))
vi.mock('../src/stores/auth', () => ({ useAuthStore: () => mock.auth }))
vi.mock('../src/stores/contacts', () => ({ useContactsStore: () => mock.contacts }))
vi.mock('../src/services/supabase', () => ({
  rpcApi: { inContactsOf: mock.inContacts },
  tablesApi: { blockedUsers: { loadBlocked: mock.blocked }, profiles: { updateLastSeen: mock.update } },
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mock.profile, error: null }) }) }) }),
    removeChannel: mock.remove,
    channel: (name: string) => {
      const handlers: Record<string, Function> = {}
      const channel = {
        name, handlers, state: {} as Record<string, unknown>,
        on: (type: string, filter: { event: string }, cb: Function) => { handlers[`${type}:${filter.event}`] = cb; return channel },
        subscribe: (cb?: Function) => { channel.subscribed = cb; return channel },
        subscribed: undefined as Function | undefined,
        presenceState: () => channel.state,
        track: vi.fn().mockResolvedValue('ok'), untrack: vi.fn().mockResolvedValue('ok'),
      }
      mock.channels.push(channel)
      return channel
    },
  },
}))
import { usePresenceStore } from '../src/stores/presence'

beforeEach(() => {
  vi.clearAllMocks()
  mock.channels.length = 0
  mock.auth.authScreen = 'logged_in'
  mock.auth.profile.online_visibility = 'all'
  mock.contacts.blockedIds = new Set()
  mock.inContacts.mockResolvedValue(false)
  mock.blocked.mockResolvedValue({ data: [], error: null })
  mock.update.mockResolvedValue({ error: null })
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  setActivePinia(createPinia())
})

describe('presence subscriptions', () => {
  it('does not expose presence to a non-contact and refreshes it when access changes', async () => {
    const store = usePresenceStore()
    await store.start('me')
    store.watchUser('other')
    await store.refresh('other')
    const global = mock.channels.find(c => c.name === 'online-users')
    global.state = { other: [{}] }
    global.handlers['presence:sync']()
    await store.refresh('other')
    expect(store.statusFor('other').online).toBe(false)
    mock.inContacts.mockResolvedValue(true)
    await store.refresh('other')
    expect(store.statusFor('other').online).toBe(true)
    mock.contacts.blockedIds.add('other')
    expect(store.statusFor('other').online).toBe(false)
    store.stop()
    expect(mock.remove).toHaveBeenCalled()
  })
  it('tracks and untracks its own presence when privacy changes', async () => {
    const store = usePresenceStore()
    await store.start('me')
    const global = mock.channels.find(c => c.name === 'online-users')
    global.subscribed('SUBSCRIBED')
    expect(global.track).toHaveBeenCalledOnce()
    mock.auth.profile.online_visibility = 'nobody'
    await store.updateOwnPresence()
    expect(global.untrack).toHaveBeenCalledOnce()
    store.stop()
  })
  it('fails closed when the contacts check fails', async () => {
    const store = usePresenceStore()
    await store.start('me')
    mock.inContacts.mockRejectedValue(new Error('offline'))
    await store.refresh('other')
    expect(store.statusFor('other').text).toBe('Был(а) недавно')
    store.stop()
  })
})

describe('pair presence', () => {
  it('uses the pair channel and drops its online state when the chat is closed', async () => {
    const store = usePresenceStore()
    await store.start('me')
    mock.inContacts.mockResolvedValue(true)
    await store.refresh('other')
    const pair = { state: { other: [{}] }, presenceState() { return this.state }, track: vi.fn(), untrack: vi.fn() }
    store.setPairChannel(pair as any)
    store.syncPair(pair as any)
    expect(store.statusFor('other').online).toBe(true)
    store.setPairChannel(null)
    expect(store.statusFor('other').online).toBe(false)
    store.stop()
  })
})
