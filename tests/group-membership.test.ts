import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mock = vi.hoisted(() => ({
  auth: { user: { id: 'me' } },
  getMembership: vi.fn(),
  getUserGroups: vi.fn(),
}))
vi.mock('../src/stores/auth', () => ({ useAuthStore: () => mock.auth }))
vi.mock('../src/services/supabase', () => ({
  tablesApi: { groupMembers: { getMembership: mock.getMembership, getUserGroups: mock.getUserGroups } },
  supabase: {}, rpcApi: {}, realtimeApi: {},
}))
vi.mock('../src/services/tauriIpc', () => ({ tauriSaveMessage: vi.fn(), tauriNotify: vi.fn() }))
import { useGroupsStore } from '../src/stores/groups'

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
})

describe('проверка участия в группе', () => {
  it('открывает ввод для участника и предлагает вступить остальным', async () => {
    const store = useGroupsStore()
    store.activeGroup = { id: 'group-1' } as any
    mock.getMembership.mockResolvedValueOnce({ data: [{ user_id: 'me' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    await store.checkMembership()
    expect(store.membershipStatus).toBe('member')
    await store.checkMembership()
    expect(store.membershipStatus).toBe('not-member')
  })

  it('проверяет список своих групп, если отдельный запрос не прошёл', async () => {
    const store = useGroupsStore()
    store.activeGroup = { id: 'group-1' } as any
    mock.getMembership.mockResolvedValue({ data: null, error: { message: 'ошибка запроса' } })
    mock.getUserGroups.mockResolvedValue({ data: [{ groups: { id: 'group-1' } }], error: null })
    await store.checkMembership()
    expect(store.membershipStatus).toBe('member')
  })

  it('не разрешает писать, если оба запроса завершились ошибкой', async () => {
    const store = useGroupsStore()
    store.activeGroup = { id: 'group-1' } as any
    mock.getMembership.mockResolvedValue({ data: null, error: { message: 'нет доступа' } })
    mock.getUserGroups.mockResolvedValue({ data: null, error: { message: 'нет доступа' } })
    await store.checkMembership()
    expect(store.membershipStatus).toBe('error')
    expect(store.membershipError).toBe('нет доступа')
    await expect(store.sendGroupMessage('привет')).rejects.toThrow('Сначала вступите в группу')
  })
})
