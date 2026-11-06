/**
 * Утилита сквозного шифрования сообщений по секретному ключу (Killer Feature)
 * 
 * Формат зашифрованного сообщения:
 * enc::v1::<salt_hex>::<iv_hex>::<ciphertext_hex>
 * 
 * Использует стандартный Web Crypto API:
 * - PBKDF2 (SHA-256, 100 000 итераций) для вывода 256-битного AES-GCM ключа из парольной фразы + соли
 * - AES-GCM (12-байтный случайный IV, 128-битный аутентификационный тег)
 */

export const ENCRYPTED_PREFIX = 'enc::v1::'

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const val = parseInt(hex.slice(i, i + 2), 16)
    if (isNaN(val)) return null
    bytes[i / 2] = val
  }
  return bytes
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const saltBuffer = new Uint8Array(salt).buffer as ArrayBuffer

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Проверяет, имеет ли строка заголовок зашифрованного протокола
 */
export function isEncryptedMessage(content: string | null | undefined): boolean {
  if (!content) return false
  return content.startsWith(ENCRYPTED_PREFIX)
}

/**
 * Зашифровать открытый текст с использованием секретного ключа
 */
export async function encryptText(text: string, keyPhrase: string): Promise<string> {
  const trimmedKey = keyPhrase.trim()
  if (!trimmedKey) {
    throw new Error('Ключ шифрования не задан')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await deriveAesKey(trimmedKey, salt)

  const encoder = new TextEncoder()
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv).buffer as ArrayBuffer,
    },
    aesKey,
    encoder.encode(text)
  )

  const saltHex = bufferToHex(salt)
  const ivHex = bufferToHex(iv)
  const cipherHex = bufferToHex(ciphertextBuffer)

  return `${ENCRYPTED_PREFIX}${saltHex}:${ivHex}:${cipherHex}`
}

export type DecryptResult =
  | { status: 'plaintext'; text: string }
  | { status: 'decrypted'; text: string }
  | { status: 'encrypted_locked'; text: string; error?: string }

/**
 * Расшифровать текст, если он зашифрован.
 * Если сообщение обычное -> status: 'plaintext'
 * Если зашифровано и ключ подошёл -> status: 'decrypted'
 * Если зашифровано, но ключ не задан или не подошёл -> status: 'encrypted_locked'
 */
export async function decryptText(
  content: string,
  keyPhrase: string | null | undefined
): Promise<DecryptResult> {
  if (!isEncryptedMessage(content)) {
    return { status: 'plaintext', text: content }
  }

  const payload = content.slice(ENCRYPTED_PREFIX.length)
  const parts = payload.split(':')
  if (parts.length !== 3) {
    return { status: 'encrypted_locked', text: 'Текст зашифрован' }
  }

  const [saltHex, ivHex, cipherHex] = parts
  const salt = hexToBytes(saltHex)
  const iv = hexToBytes(ivHex)
  const ciphertext = hexToBytes(cipherHex)

  if (!salt || !iv || !ciphertext) {
    return { status: 'encrypted_locked', text: 'Текст зашифрован' }
  }

  const trimmedKey = keyPhrase?.trim()
  if (!trimmedKey) {
    // Ключ не введен пользователем, сообщение зашифровано
    return { status: 'encrypted_locked', text: 'Текст зашифрован' }
  }

  try {
    const aesKey = await deriveAesKey(trimmedKey, salt)
    const cipherBuffer = new Uint8Array(ciphertext).buffer as ArrayBuffer
    const ivBuffer = new Uint8Array(iv).buffer as ArrayBuffer

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      aesKey,
      cipherBuffer
    )

    const decoder = new TextDecoder()
    const plain = decoder.decode(decryptedBuffer)
    return { status: 'decrypted', text: plain }
  } catch {
    // Неверный ключ или повреждённые данные (GCM тег не совпал)
    return { status: 'encrypted_locked', text: 'Текст зашифрован' }
  }
}
