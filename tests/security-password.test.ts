import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ verify: vi.fn(), signOut: vi.fn(), update: vi.fn(), createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('../src/services/supabase', () => ({
  SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'public-key',
  supabase: { auth: { updateUser: mocks.update } },
}))
import { authApi } from '../src/services/backend/authApi'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockReturnValue({ auth: { signInWithPassword: mocks.verify, signOut: mocks.signOut } })
  mocks.verify.mockResolvedValue({ error: null })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.update.mockResolvedValue({ error: null })
  vi.stubGlobal('crypto', { randomUUID: () => 'check' })
})
describe('changing password', () => {
  it('checks the current password in an isolated session before changing it', async () => {
    await authApi.changePassword('a@example.com', 'old', 'newpass1')
    expect(mocks.verify).toHaveBeenCalledWith({ email: 'a@example.com', password: 'old' })
    expect(mocks.update).toHaveBeenCalledWith({ password: 'newpass1' })
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('does not update the password if the current one is incorrect', async () => {
    mocks.verify.mockResolvedValue({ error: new Error('invalid credentials') })
    await expect(authApi.changePassword('a@example.com', 'wrong', 'newpass1')).rejects.toThrow('invalid credentials')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('ends the verification session when the update fails', async () => {
    mocks.update.mockResolvedValue({ error: new Error('network') })
    await expect(authApi.changePassword('a@example.com', 'old', 'newpass1')).rejects.toThrow('network')
    expect(mocks.signOut).toHaveBeenCalled()
  })
})
