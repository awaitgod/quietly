import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mock = vi.hoisted(() => ({
  session: vi.fn(), verify: vi.fn(), password: vi.fn(), update: vi.fn(), otp: vi.fn(), signout: vi.fn(),
  profile: vi.fn(), upsertProfile: vi.fn(), profileNames: vi.fn(), groupNames: vi.fn(),
  deviceCheck: vi.fn(), deviceUpsert: vi.fn(), message: vi.fn(), deleteIncomplete: vi.fn(),
  upload: vi.fn(), publicUrl: vi.fn(), admin: vi.fn(), listener: vi.fn(), ip: vi.fn(),
}))
vi.mock('../src/services/supabase', () => ({
  supabase: { auth: { onAuthStateChange: mock.listener }, storage: { from: () => ({ upload: mock.upload, getPublicUrl: mock.publicUrl }) } },
  authApi: { getSession: mock.session, verifyOtp: mock.verify, signInWithPassword: mock.password, updatePassword: mock.update, signInWithOtp: mock.otp, signOut: mock.signout },
  rpcApi: { deleteIncompleteAccount: mock.deleteIncomplete, isAdmin: mock.admin },
  tablesApi: { profiles: { getById: mock.profile, checkUsername: mock.profileNames, upsertProfile: mock.upsertProfile }, groups: { checkUsername: mock.groupNames }, userDevices: { checkRevoked: mock.deviceCheck, upsertDevice: mock.deviceUpsert }, systemMessages: { insert: mock.message } },
  externalApi: { fetchExternalIp: mock.ip },
}))
import { useAuthStore } from '../src/stores/auth'

const user = { id: 'user-1', email: 'user@example.com' }
const session = { user, access_token: 'token' }
const existing = { id: user.id, username: 'username' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', (() => { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) } })())
  vi.stubGlobal('navigator', { userAgent: 'test' })
  setActivePinia(createPinia())
  mock.session.mockResolvedValue({ data: { session: null }, error: null })
  mock.verify.mockResolvedValue({ data: { user, session }, error: null })
  mock.password.mockResolvedValue({ data: { user, session }, error: null })
  mock.profile.mockResolvedValue({ data: existing, error: null })
  mock.update.mockResolvedValue({ error: null })
  mock.otp.mockResolvedValue({ error: null })
  mock.profileNames.mockResolvedValue({ data: [], error: null })
  mock.groupNames.mockResolvedValue({ data: [], error: null })
  mock.deviceCheck.mockResolvedValue({ data: null })
  mock.deviceUpsert.mockResolvedValue({ error: null })
  mock.message.mockResolvedValue({ error: null })
  mock.upload.mockResolvedValue({ error: null })
  mock.publicUrl.mockReturnValue({ data: { publicUrl: 'https://example.test/avatar.jpg' } })
  mock.upsertProfile.mockResolvedValue({ error: null })
  mock.admin.mockResolvedValue(false)
  mock.ip.mockResolvedValue(null)
  mock.deleteIncomplete.mockResolvedValue(true)
  mock.signout.mockResolvedValue({ error: null })
})

describe('authentication flow', () => {
  it('keeps a confirmed existing account on the password screen after restart', async () => {
    localStorage.setItem('auth_flow_pending', '1')
    mock.session.mockResolvedValue({ data: { session }, error: null })
    const auth = useAuthStore()
    await auth.initAuth()
    expect(auth.authScreen).toBe('password_login')
    expect(mock.deleteIncomplete).not.toHaveBeenCalled()
  })
  it('does not delete an account when profile lookup fails', async () => {
    localStorage.setItem('auth_flow_pending', '1')
    mock.session.mockResolvedValue({ data: { session }, error: null })
    mock.profile.mockResolvedValue({ data: null, error: new Error('offline') })
    const auth = useAuthStore()
    await auth.initAuth()
    expect(mock.deleteIncomplete).not.toHaveBeenCalled()
    expect(localStorage.getItem('auth_flow_pending')).toBe('1')
  })
  it('checks users and groups before creating a profile and waits for a password', async () => {
    const auth = useAuthStore()
    auth.user = user
    const avatar = new Blob(['image'])
    await auth.saveProfileSetup('Name', 'newname', avatar)
    expect(auth.authScreen).toBe('password_set')
    expect(mock.upsertProfile).not.toHaveBeenCalled()
    await auth.setInitialPassword('password1')
    expect(mock.upload).toHaveBeenCalledOnce()
    expect(mock.upsertProfile).toHaveBeenCalledOnce()
    expect(auth.authScreen).toBe('logged_in')
  })
  it('rejects a username occupied by a public group', async () => {
    const auth = useAuthStore()
    auth.user = user
    mock.groupNames.mockResolvedValue({ data: [{ id: 'group' }], error: null })
    await expect(auth.saveProfileSetup('Name', 'taken', new Blob(['x']))).rejects.toThrow('занят')
    expect(mock.upsertProfile).not.toHaveBeenCalled()
  })
  it('routes verified existing users to password and clears the pending flag only after login', async () => {
    const auth = useAuthStore()
    auth.emailDraft = user.email
    await auth.verifyOtp('123456')
    expect(auth.authScreen).toBe('password_login')
    expect(localStorage.getItem('auth_flow_pending')).toBe('1')
    await auth.loginWithPassword('password1')
    expect(auth.authScreen).toBe('logged_in')
    expect(localStorage.getItem('auth_flow_pending')).toBeNull()
  })
  it('refuses access for a blocked profile', async () => {
    const auth = useAuthStore()
    auth.emailDraft = user.email
    mock.profile.mockResolvedValue({ data: { ...existing, banned_at: '2026-01-01' }, error: null })
    await expect(auth.loginWithPassword('password1')).rejects.toThrow('заблокирован')
    expect(auth.authScreen).not.toBe('logged_in')
  })
})

describe('recovery and interrupted registration', () => {
  it('requires a fresh code before resetting a password from the direct login screen', async () => {
    const auth = useAuthStore()
    auth.emailDraft = user.email
    await auth.beginRecovery()
    expect(mock.otp).toHaveBeenCalledOnce()
    expect(auth.authScreen).toBe('otp')
    await auth.verifyOtp('123456')
    expect(auth.authScreen).toBe('forgot')
    await auth.resetPassword('newpass12')
    expect(mock.update).toHaveBeenCalledWith('newpass12')
    expect(auth.authScreen).toBe('logged_in')
  })
  it('cleans up a confirmed registration with no profile on restart', async () => {
    localStorage.setItem('auth_flow_pending', '1')
    mock.session.mockResolvedValue({ data: { session }, error: null })
    mock.profile.mockResolvedValue({ data: null, error: null })
    const auth = useAuthStore()
    await auth.initAuth()
    expect(mock.deleteIncomplete).toHaveBeenCalledOnce()
    expect(auth.authScreen).toBe('email')
    expect(localStorage.getItem('auth_flow_pending')).toBeNull()
  })
  it('signs out the pending session before changing accounts', async () => {
    localStorage.setItem('auth_flow_pending', '1')
    const auth = useAuthStore()
    auth.user = user
    await auth.changeEmail()
    expect(mock.signout).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.user).toBeNull()
    expect(localStorage.getItem('auth_flow_pending')).toBeNull()
  })
})
