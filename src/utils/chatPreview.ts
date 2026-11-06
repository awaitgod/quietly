import { CONTENT_PREFIX } from '../types'

export function attachmentPreview(content: string): { kind: 'image' | 'audio'; text: string; thumbnail?: string } | null {
  const isImage = content.startsWith(CONTENT_PREFIX.IMAGE)
  const isAudio = content.startsWith(CONTENT_PREFIX.AUDIO)
  if (!isImage && !isAudio) return null
  const raw = content.slice((isImage ? CONTENT_PREFIX.IMAGE : CONTENT_PREFIX.AUDIO).length)
  let payload: { url?: unknown; title?: unknown } = {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') payload = parsed as typeof payload
    else if (typeof parsed === 'string') payload.url = parsed
  } catch { if (isImage) payload.url = raw }
  if (isAudio) {
    const title = typeof payload.title === 'string' ? payload.title.trim() : ''
    return { kind: 'audio', text: title ? `Аудио: ${title}` : 'Аудиозапись' }
  }
  let thumbnail: string | undefined
  if (typeof payload.url === 'string') {
    try {
      const url = new URL(payload.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') thumbnail = url.href
    } catch { /* Не показываем миниатюру для повреждённой ссылки. */ }
  }
  return { kind: 'image', text: 'Фотография', thumbnail }
}
