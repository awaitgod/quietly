import { describe, expect, it } from 'vitest'
import { attachmentPreview } from '../src/utils/chatPreview'

describe('предпросмотр вложений в списке чатов', () => {
  it('показывает миниатюру фотографии и поддерживает старый формат ссылки', () => {
    expect(attachmentPreview('img::{"url":"https://example.com/photo.jpg"}')).toEqual({ kind: 'image', text: 'Фотография', thumbnail: 'https://example.com/photo.jpg' })
    expect(attachmentPreview('img::https://example.com/photo.jpg')?.thumbnail).toBe('https://example.com/photo.jpg')
  })

  it('показывает название аудио и не раскрывает служебные данные при ошибке', () => {
    expect(attachmentPreview('audio::{"url":"https://example.com/a.mp3","title":"Песня"}')).toEqual({ kind: 'audio', text: 'Аудио: Песня' })
    expect(attachmentPreview('audio::{сломано')).toEqual({ kind: 'audio', text: 'Аудиозапись' })
    expect(attachmentPreview('img::javascript:alert(1)')).toEqual({ kind: 'image', text: 'Фотография', thumbnail: undefined })
    expect(attachmentPreview('обычное сообщение')).toBeNull()
  })
})
