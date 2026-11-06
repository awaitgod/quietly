<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import { encryptText } from '../../utils/encryption'
import SolarIcon from '../common/SolarIcon.vue'
import StickerPanel from './StickerPanel.vue'
import EmojiText from '../common/EmojiText.vue'
import EmojiEditor from './EmojiEditor.vue'
import { tablesApi, storageApi } from '../../services/supabase'
import { useAuthStore } from '../../stores/auth'
import { CONTENT_PREFIX } from '../../types'

const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const settingsStore = useSettingsStore()

const text = ref('')
const savingEdit = ref(false)
const editError = ref('')
const savedDraft = ref('')
const isStickerPanelOpen = ref(false)
const editorRef = ref<InstanceType<typeof EmojiEditor> | null>(null)
const authStore = useAuthStore()
const isSendingText = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isUploadingFile = ref(false)
const uploadProgressText = ref('')

function triggerFileSelect() {
  fileInputRef.value?.click()
}

async function handleFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  if (!authStore.user?.id) {
    alert('Необходимо авторизоваться')
    return
  }

  const isImg = file.type.startsWith('image/')
  const isAud = file.type.startsWith('audio/') || /.(mp3|wav|ogg|m4a|flac)$/i.test(file.name)

  if (!isImg && !isAud) {
    alert('Пожалуйста, выберите изображение или аудиофайл')
    return
  }

  isUploadingFile.value = true
  uploadProgressText.value = isImg ? 'Отправка фото...' : 'Отправка музыки...'

  try {
    const ext = file.name.split('.').pop() || (isImg ? 'jpg' : 'mp3')
    if (isImg) {
      const res = await storageApi.chat.uploadImage(authStore.user.id, file, ext, file.type || 'image/jpeg')
      if (res.error) throw res.error
      const payload = {
        url: res.data.publicUrl,
        name: file.name,
        size: file.size,
      }
      const msgContent = `${CONTENT_PREFIX.IMAGE}${JSON.stringify(payload)}`
      if (isGroup.value) {
        await groupsStore.sendGroupMessage(msgContent, chatStore.replyContext?.id)
      } else {
        await chatStore.sendMessage(msgContent, chatStore.replyContext?.id)
      }
      chatStore.replyContext = null
    } else {
      const res = await storageApi.chat.uploadAudio(authStore.user.id, file, ext, file.type || 'audio/mpeg')
      if (res.error) throw res.error
      const title = file.name.replace(/.[^.]+$/, '').slice(0, 50) || 'Аудиозапись'
      const payload = {
        url: res.data.publicUrl,
        title,
        artist: authStore.profile?.name || 'Вы',
        size: file.size,
      }
      const msgContent = `${CONTENT_PREFIX.AUDIO}${JSON.stringify(payload)}`
      if (isGroup.value) {
        await groupsStore.sendGroupMessage(msgContent, chatStore.replyContext?.id)
      } else {
        await chatStore.sendMessage(msgContent, chatStore.replyContext?.id)
      }
      chatStore.replyContext = null
    }
  } catch (err: any) {
    console.error('File upload failed:', err)
    alert('Ошибка при отправке файла: ' + (err.message || 'попробуйте ещё раз'))
  } finally {
    isUploadingFile.value = false
    uploadProgressText.value = ''
  }
}
const flyingBubble = ref<{ text: string; top: number; right: number } | null>(null)

const isGroup = computed(() => !!groupsStore.activeGroup)

const canSend = computed(() => {
  return text.value.trim().length > 0
})

async function handleSend() {
  const content = text.value.trim()
  if (!content || savingEdit.value) return
  if (chatStore.editContext) {
    const editing = chatStore.editContext
    const groupId = groupsStore.activeGroup?.id
    savingEdit.value = true; editError.value = ''
    try {
      if (groupId) {
        const id = Number(editing.id)
        if (!Number.isSafeInteger(id)) throw new Error('Сообщение ещё не отправлено')
        const result = await tablesApi.groupMessages.edit(id, content)
        if (result.error || !result.data) throw result.error || new Error('Не удалось сохранить')
        if (groupsStore.activeGroup?.id === groupId) { const index = groupsStore.groupMessages.findIndex(m => String(m.id) === String(editing.id)); if (index !== -1) groupsStore.groupMessages[index] = result.data }
      } else await chatStore.editMessage(editing.id, content)
      if (chatStore.editContext?.id === editing.id) { chatStore.editContext = null; text.value = savedDraft.value; savedDraft.value = ''; nextTick(handleInput) }
    } catch { editError.value = 'Не удалось сохранить изменение. Проверьте соединение и попробуйте снова.' }
    finally { savingEdit.value = false }
    return
  }

  // Smooth transfer animation from input into message feed
  if (editorRef.value && !chatStore.editContext) {
    const rect = editorRef.value.getBoundingClientRect()!
    flyingBubble.value = {
      text: content,
      top: rect.top - 8,
      right: Math.max(20, window.innerWidth - rect.right),
    }
    isSendingText.value = true
    setTimeout(() => {
      flyingBubble.value = null
      isSendingText.value = false
    }, 200)
  }

  let finalContent = content
  if (settingsStore.encryptionEnabled && settingsStore.encryptionKey.trim()) {
    try {
      finalContent = await encryptText(content, settingsStore.encryptionKey)
    } catch (e) {
      console.error('[Encryption] Failed to encrypt message:', e)
    }
  }

  if (isGroup.value) {
    groupsStore.sendGroupMessage(finalContent, chatStore.replyContext?.id)
    chatStore.replyContext = null
  } else {
    chatStore.sendMessage(finalContent, chatStore.replyContext?.id)
    chatStore.replyContext = null
  }

  text.value = ''
}

function handleInput() { if (!isGroup.value) chatStore.sendTyping() }
function onSelectEmoji(emoji: string) { editorRef.value?.insertEmoji(emoji) }

function onSelectSticker(stickerSrc: string) {
  isStickerPanelOpen.value = false
  if (isGroup.value) {
    groupsStore.sendGroupMessage(`sticker::${stickerSrc}`)
  } else {
    chatStore.sendMessage(`sticker::${stickerSrc}`)
  }
}

watch(() => chatStore.editContext, (value, previous) => { if (value) { if (!previous) savedDraft.value = text.value; editError.value = ''; text.value = value.content; nextTick(() => { handleInput(); editorRef.value?.focus() }) } })
watch(() => chatStore.replyContext, value => { if (value) nextTick(() => editorRef.value?.focus()) })
function cancelContext() {
  if (savingEdit.value) return
  if (chatStore.editContext) { text.value = savedDraft.value; savedDraft.value = ''; nextTick(handleInput) }
  editError.value = ''
  chatStore.replyContext = null
  chatStore.editContext = null
}
</script>

<template>
  <div class="chat-input-wrapper">
    <div class="composer-surface" :class="{ 'has-context': chatStore.replyContext || chatStore.editContext }">
    <!-- Context Bar (Reply / Edit) -->
    <div v-if="chatStore.replyContext || chatStore.editContext" class="chat-ctx">
      <div class="chat-ctx-ic">
        <SolarIcon
          :name="chatStore.editContext ? 'pen-linear' : 'reply-linear'"
          :size="18"
          color="#4a63f0"
        />
      </div>
      <div class="chat-ctx-body">
        <b>{{ chatStore.editContext ? 'Редактирование сообщения' : 'Ответ на сообщение' }}</b>
        <span v-if="!chatStore.editContext">{{ chatStore.replyContext?.content }}</span>
      </div>
      <button type="button" class="sp-x" aria-label="Отменить" :disabled="savingEdit" @click="cancelContext">
        <SolarIcon name="close-circle-linear" :size="18" />
      </button>
    </div>

    <div class="chat-input-row">
      <div class="chat-pill-box">
        <!-- Hidden file input for images & audio -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*,audio/*"
          style="display: none;"
          @change="handleFileSelected"
        />

        <!-- Attachment / Paperclip Button -->
        <button
          type="button"
          class="chat-attach-btn"
          :disabled="isUploadingFile"
          aria-label="Прикрепить изображение или музыку"
          title="Отправить фото или аудио"
          @click="triggerFileSelect"
        >
          <SolarIcon v-if="!isUploadingFile" name="paperclip-linear" :size="22" />
          <span v-else class="upload-spinner"></span>
        </button>

        <div class="emoji-anchor">
      <button
        type="button"
        class="chat-emoji-btn"
        :class="{ on: isStickerPanelOpen }"
        aria-label="Стикеры и эмодзи" :aria-expanded="isStickerPanelOpen"
        @click="isStickerPanelOpen = !isStickerPanelOpen"
      >
        <SolarIcon name="smile-circle-linear" :size="24" />
      </button>
          <StickerPanel v-if="isStickerPanelOpen" @select-emoji="onSelectEmoji" @select-sticker="onSelectSticker" @close="isStickerPanelOpen = false" />
        </div>
        <EmojiEditor ref="editorRef" v-model="text" @send="handleSend" @typing="handleInput" />

        <!-- Upward Arrow Send Button -->
        <button
          type="button"
          class="chat-send-btn"
          :class="{ active: canSend, encrypted: settingsStore.encryptionEnabled && settingsStore.encryptionKey.trim() }"
          :disabled="!canSend || savingEdit"
          :aria-label="chatStore.editContext ? 'Сохранить изменение' : 'Отправить сообщение'"
          :title="settingsStore.encryptionEnabled && settingsStore.encryptionKey.trim() ? 'Шифрование ключом активно' : undefined"
          @click="handleSend"
        >
          <SolarIcon v-if="chatStore.editContext" name="check-linear" :size="20" />
          <SolarIcon v-else-if="settingsStore.encryptionEnabled && settingsStore.encryptionKey.trim()" name="lock-keyhole-bold" :size="17" />
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <p v-if="editError" class="composer-error" role="alert">{{ editError }}</p>
    </div>
    <!-- Telegram-Style Flying Bubble Clone From Input -->
    <Teleport to="body">
      <div
        v-if="flyingBubble"
        class="tg-flying-ghost-bubble"
        :style="{
          top: `${flyingBubble.top}px`,
          right: `${flyingBubble.right}px`,
        }"
      >
        <EmojiText :text="flyingBubble.text" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
:global(html[data-theme="light"]) .chat-emoji-btn,
:global(html[data-theme="light"]) .chat-attach-btn {
  color: #64748b;
}
:global(html[data-theme="light"]) .chat-emoji-btn:hover,
:global(html[data-theme="light"]) .chat-emoji-btn.on,
:global(html[data-theme="light"]) .chat-attach-btn:hover {
  color: #0f172a !important;
  background-color: rgba(15, 23, 42, 0.08) !important;
}
:global(html[data-theme="light"]) .chat-attach-btn:hover :deep(.solar-icon) {
  color: #0f172a !important;
}
:global(html[data-theme="light"]) .chat-send-btn { background: #e1e1e6; color: #686872; }
:global(html[data-theme="light"]) .chat-send-btn.active { background: #202026; color: #fff; }
:global(html[data-theme="light"]) .chat-send-btn.active.encrypted {
  background-color: #0a84ff !important;
  color: #ffffff !important;
}
.chat-send-btn.active:hover { background: #33333b; }

.chat-input-wrapper {
  position: relative;
  width: 100%;
  padding: var(--space-2) var(--space-6) max(var(--space-2), env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: transparent;
  flex-shrink: 0;
}

.composer-surface { width: min(100%, 900px); margin-inline: auto; border-radius: 24px 24px 24px 24px; background: var(--surface); }
.composer-surface.has-context { border-radius: var(--radius-lg); }
.composer-surface :deep(.emoji-editor:focus-visible) { outline: none !important; box-shadow: none !important; }
.chat-ctx {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: min(100%, 900px);
  margin-inline: auto;
  padding: var(--space-3) var(--space-4) var(--space-1);
  background: transparent;

}

.chat-ctx-body {
  flex: 1;
  min-width: 0;
}

.chat-ctx-body b {
  display: block;
  font-size: var(--text-12);
  color: var(--text);
}
.composer-error { padding: 0 var(--space-4) var(--space-3); margin: 0; color: var(--danger); font-size: var(--text-12); }
.chat-ctx-body span {
  display: block;
  font-size: var(--text-14);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sp-x {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: var(--space-1);
  display: flex;
  align-items: center;
}

.chat-input-row {
  position: relative;
  padding: 0;
  background: transparent;
  flex-wrap: nowrap;
  border-radius: inherit;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: 900px;
  margin-inline: auto;
}

:global(#loggedInScreen.chat-open) .chat-input-row { padding: 0; background: transparent; }
.emoji-anchor { position: relative; flex: none; }
.chat-attach-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #8e8e93;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, transform 0.15s;
  flex-shrink: 0;
  padding: 0;
}
.chat-attach-btn:hover {
  color: #ffffff;
}
.chat-attach-btn:active {
  transform: scale(0.92);
}
:global(html[data-theme="light"]) .chat-attach-btn:hover {
  color: #222;
}
.upload-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: #0a84ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.chat-emoji-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #8e8e93;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, transform 0.15s;
  flex-shrink: 0;
  padding: 0;
}

.chat-emoji-btn:hover,
.chat-emoji-btn.on {
  color: #ffffff;
}

.chat-emoji-btn:active {
  transform: scale(0.92);
}

/* Capsule Pill Input Container */
.chat-pill-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: transparent;
  border: 0;
  border-radius: 999px;
  min-height: 44px;
  padding: var(--space-1) var(--space-1-5);
  box-sizing: border-box;
}

/* Upward Arrow Send Button Inside Pill */
.chat-send-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background-color: #2b2b33;
  color: #8e8e93;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.15s;
  flex-shrink: 0;
  padding: 0;
}

.chat-send-btn.active {
  background-color: #ffffff;
  color: #000000;
  cursor: pointer;
}

.chat-send-btn.active:hover {
  background-color: #f4f4f5;
  transform: scale(1.04);
}

.chat-send-btn.active:active {
  transform: scale(0.92);
}

.tg-flying-ghost-bubble {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  background: #ffffff;
  color: #000000;
  border-radius: 18px 18px 4px 18px;
  padding: var(--space-2) 14px 7px;
  font-size: var(--text-14);
  line-height: 1.4;
  max-width: min(78%, 460px);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  font-family: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  animation: tgFlyUpFromInput 0.20s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  will-change: transform, opacity;
}

@keyframes tgFlyUpFromInput {
  0% {
    opacity: 0.96;
    transform: translateY(0) scale(0.96);
  }
  100% {
    opacity: 0;
    transform: translateY(-58px) scale(1);
  }
}
</style>
