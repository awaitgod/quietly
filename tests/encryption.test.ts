import { describe, it, expect } from 'vitest'
import {
  encryptText,
  decryptText,
  isEncryptedMessage,
  ENCRYPTED_PREFIX,
} from '../src/utils/encryption'

describe('encryption utility (Killer Features)', () => {
  it('correctly identifies encrypted messages', () => {
    expect(isEncryptedMessage('Hello world')).toBe(false)
    expect(isEncryptedMessage('enc::v1::123:456:789')).toBe(true)
    expect(isEncryptedMessage('')).toBe(false)
  })

  it('encrypts and decrypts correctly with the same key', async () => {
    const secret = 'super-secret-key-123'
    const originalText = 'Привет, это секретное сообщение! 🤫'

    const encrypted = await encryptText(originalText, secret)
    expect(encrypted.startsWith(ENCRYPTED_PREFIX)).toBe(true)
    expect(encrypted).not.toContain(originalText)

    const result = await decryptText(encrypted, secret)
    expect(result.status).toBe('decrypted')
    expect(result.text).toBe(originalText)
  })

  it('fails to decrypt and shows "Текст зашифрован" when key is wrong', async () => {
    const keyA = 'key-alpha'
    const keyB = 'key-beta'
    const originalText = 'Секретная переписка'

    const encrypted = await encryptText(originalText, keyA)
    const result = await decryptText(encrypted, keyB)

    expect(result.status).toBe('encrypted_locked')
    expect(result.text).toBe('Текст зашифрован')
  })

  it('shows "Текст зашифрован" when user has no key configured', async () => {
    const keyA = 'key-alpha'
    const originalText = 'Секретная переписка'

    const encrypted = await encryptText(originalText, keyA)
    const resultEmpty = await decryptText(encrypted, '')
    const resultNull = await decryptText(encrypted, null)

    expect(resultEmpty.status).toBe('encrypted_locked')
    expect(resultEmpty.text).toBe('Текст зашифрован')
    expect(resultNull.status).toBe('encrypted_locked')
    expect(resultNull.text).toBe('Текст зашифрован')
  })

  it('passes regular plaintext messages as plaintext', async () => {
    const plainText = 'Обычный текст без шифрования'
    const result = await decryptText(plainText, 'some-key')

    expect(result.status).toBe('plaintext')
    expect(result.text).toBe(plainText)
  })

  it('handles corrupted cipher string safely', async () => {
    const corrupted = 'enc::v1::invalid_payload'
    const result = await decryptText(corrupted, 'key')
    expect(result.status).toBe('encrypted_locked')
    expect(result.text).toBe('Текст зашифрован')
  })
})
