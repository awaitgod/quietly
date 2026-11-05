import { beforeEach, expect, it, vi } from 'vitest'
const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../src/services/native/environment', () => ({ isTauri: () => true }))
import { setLocalCacheAccount, tauriGetMessages, tauriSaveMessage, tauriDeleteMessage } from '../src/services/native/messages'

beforeEach(() => { invoke.mockReset(); setLocalCacheAccount(null) })
it('isolates cached message identifiers and refuses access without an account', async () => {
  const message = { id: 'message', sender_id: 'sender', content: 'hello', created_at: '2026-01-01' }
  await tauriSaveMessage(message, 'chat')
  expect(invoke).not.toHaveBeenCalled()
  setLocalCacheAccount('account-a')
  await tauriSaveMessage(message, 'chat')
  expect(invoke).toHaveBeenCalledWith('save_local_message', expect.objectContaining({ message: expect.objectContaining({ id: 'account-a:message', chat_id: 'account-a:chat' }) }))
  invoke.mockResolvedValueOnce([{ id: 'account-a:message', chat_id: 'account-a:chat' }])
  expect(await tauriGetMessages('chat')).toEqual([{ id: 'message', chat_id: 'chat' }])
  setLocalCacheAccount('account-b')
  await tauriDeleteMessage('chat', 'message')
  expect(invoke).toHaveBeenLastCalledWith('delete_local_message', { chatId: 'account-b:chat', messageId: 'account-b:message' })
})
