<script setup lang="ts">
import { useEconomyStore } from '../../stores/economy'
import GiftArt from '../common/GiftArt.vue'
const economyStore = useEconomyStore()
import EmojiText from '../common/EmojiText.vue'
import { emojiHtml } from '../../utils/emoji'

import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type {
  Message,
  UserProfile,
  ForwardContentPayload,
  GiftContentPayload,
  ServiceContentPayload,
  ImageContentPayload,
  AudioContentPayload,
} from '../../types'
import { CONTENT_PREFIX, UNICODE_FORMAT } from '../../types'
import { useAuthStore } from '../../stores/auth'
import { useAudioStore } from '../../stores/audio'
import { stickerUrl as resolveStickerUrl, isVideoSticker } from '../../utils/stickers'
import { useSettingsStore } from '../../stores/settings'
import { decryptText, isEncryptedMessage } from '../../utils/encryption'
import SolarIcon from '../common/SolarIcon.vue'

const props = withDefaults(
  defineProps<{
    message: Message
    replyMessage?: Message
    replyAuthor?: string
    highlighted?: boolean
    senderProfile?: UserProfile | null
    isGroup?: boolean
    isSelected?: boolean
    isSelectionMode?: boolean
    groupPosition?: 'single' | 'first' | 'middle' | 'last'
    showAvatar?: boolean
    showSenderName?: boolean
    dateSeparator?: string | null
    isNew?: boolean
  }>(),
  {
    groupPosition: 'single',
    showAvatar: true,
    showSenderName: true,
    dateSeparator: null,
    isNew: false,
  }
)

const emit = defineEmits<{
  (e: 'reply', message: Message): void
  (e: 'edit', message: Message): void
  (e: 'pin', message: Message): void
  (e: 'delete', message: Message): void
  (e: 'select', message: Message): void
  (e: 'double-tap', message: Message): void
  (e: 'reaction', payload: { message: Message; emoji: string }): void
  (e: 'jump-to-reply', replyId: string | number): void
  (e: 'open-sticker-pack', sticker: string): void
}>()

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
function openSenderProfile() {
  if (props.senderProfile) settingsStore.openUserProfile(props.senderProfile)
}

const resolvedText = ref('')
const isKeyEncrypted = ref(false)
const isLockedEncrypted = ref(false)


const isMine = computed(() => {
  return props.message.sender_id === authStore.user?.id
})

// 1. Sticker check
const isSticker = computed(() => {
  return props.message.content.startsWith(CONTENT_PREFIX.STICKER)
})

const stickerUrl = computed(() => {
  if (!isSticker.value) return ''
  const src = props.message.content.replace(CONTENT_PREFIX.STICKER, '')
  return resolveStickerUrl(src)
})

// 2. Service check (svc::)
const isService = computed(() => {
  return props.message.content.startsWith(CONTENT_PREFIX.SERVICE)
})

const servicePayload = computed<ServiceContentPayload | null>(() => {
  if (!isService.value) return null
  try {
    return JSON.parse(props.message.content.replace(CONTENT_PREFIX.SERVICE, ''))
  } catch {
    return null
  }
})

// 3. Forwarded check (fwd::)
const isForward = computed(() => {
  return props.message.content.startsWith(CONTENT_PREFIX.FORWARD)
})

const forwardPayload = computed<ForwardContentPayload | null>(() => {
  if (!isForward.value) return null
  try {
    return JSON.parse(props.message.content.replace(CONTENT_PREFIX.FORWARD, ''))
  } catch {
    return null
  }
})

watch(
  [() => props.message.content, () => settingsStore.encryptionKey],
  async ([msgContent, key]: [string, string], _old, onCleanup) => {
    let stale = false
    onCleanup(() => { stale = true })
    let raw = msgContent
    if (isForward.value && forwardPayload.value) {
      raw = forwardPayload.value.c
    }
    if (isEncryptedMessage(raw)) {
      isKeyEncrypted.value = true
      isLockedEncrypted.value = true
      resolvedText.value = 'Текст зашифрован'
      const res = await decryptText(raw, key)
      if (stale) return
      if (res.status === 'decrypted') {
        resolvedText.value = res.text
        isLockedEncrypted.value = false
      } else {
        resolvedText.value = 'Текст зашифрован'
        isLockedEncrypted.value = true
      }
    } else {
      isKeyEncrypted.value = false
      isLockedEncrypted.value = false
      resolvedText.value = raw
    }
  },
  { immediate: true }
)


// 4. Gift check (gift::)
const isGift = computed(() => {
  return props.message.content.startsWith(CONTENT_PREFIX.GIFT)
})

const giftPayload = computed<GiftContentPayload | null>(() => {
  if (!isGift.value) return null
  try {
    return JSON.parse(props.message.content.replace(CONTENT_PREFIX.GIFT, ''))
  } catch {
    return null
  }
})

const giftInfo = computed(() => economyStore.defaultGifts.find(g => g.id === giftPayload.value?.g))

// 5. E2E Envelope check (e2e1: / g2:)
const isE2E = computed(() => {
  return (
    props.message.content.startsWith(CONTENT_PREFIX.E2E_DM) ||
    props.message.content.startsWith(CONTENT_PREFIX.E2E_GRP)
  )
})

// Image message (img::)
const isImage = computed(() => {
  return props.message.content.startsWith(CONTENT_PREFIX.IMAGE)
})

const imagePayload = computed<ImageContentPayload | null>(() => {
  if (!isImage.value) return null
  try {
    return JSON.parse(props.message.content.slice(CONTENT_PREFIX.IMAGE.length))
  } catch {
    return { url: props.message.content.slice(CONTENT_PREFIX.IMAGE.length) }
  }
})

// Audio message (audio::)
const isAudio = computed(() => {
  return props.message.content.startsWith(CONTENT_PREFIX.AUDIO)
})

const audioPayload = computed<AudioContentPayload | null>(() => {
  if (!isAudio.value) return null
  try {
    return JSON.parse(props.message.content.slice(CONTENT_PREFIX.AUDIO.length))
  } catch {
    return null
  }
})

const audioStore = useAudioStore()
const isCurrentAudioPlaying = computed(() => {
  return audioStore.currentTrack?.audio_url === audioPayload.value?.url && audioStore.isPlaying
})

function handleToggleAudio() {
  if (!audioPayload.value) return
  const trackId = `msg_${props.message.id}`
  const trackItem = {
    id: trackId,
    user_id: props.message.sender_id,
    title: audioPayload.value.title || 'Аудиозапись',
    artist: audioPayload.value.artist || (isMine.value ? 'Вы' : props.senderProfile?.name || 'Музыка'),
    duration: audioPayload.value.duration || 0,
    audio_path: '',
    audio_url: audioPayload.value.url,
    transient: true,
  }
  if (audioStore.currentTrack?.audio_url === audioPayload.value.url) {
    audioStore.togglePlay()
  } else {
    // Inject and play
    const existingIdx = audioStore.tracks.findIndex(t => t.audio_url === audioPayload.value!.url)
    if (existingIdx !== -1) {
      audioStore.playTrack(existingIdx)
    } else {
      audioStore.tracks.push(trackItem)
      audioStore.playTrack(audioStore.tracks.length - 1)
    }
  }
}

function handleImageClick() {
  if (!imagePayload.value?.url) return
  if (props.isSelectionMode) {
    emit('select', props.message)
    return
  }
  settingsStore.openImagePreview(imagePayload.value.url, imagePayload.value.name || 'Изображение')
}

// 6. Unicode formatting parser
function renderFormattedContent(text: string): string {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Delimiters
  html = html.replace(new RegExp(`${UNICODE_FORMAT.BOLD}(.+?)${UNICODE_FORMAT.BOLD}`, 'g'), '<b>$1</b>')
  html = html.replace(new RegExp(`${UNICODE_FORMAT.ITALIC}(.+?)${UNICODE_FORMAT.ITALIC}`, 'g'), '<i>$1</i>')
  html = html.replace(new RegExp(`${UNICODE_FORMAT.UNDERLINE}(.+?)${UNICODE_FORMAT.UNDERLINE}`, 'g'), '<u>$1</u>')
  html = html.replace(new RegExp(`${UNICODE_FORMAT.STRIKE}(.+?)${UNICODE_FORMAT.STRIKE}`, 'g'), '<s>$1</s>')
  html = html.replace(new RegExp(`${UNICODE_FORMAT.MONOSPACE}(.+?)${UNICODE_FORMAT.MONOSPACE}`, 'g'), '<code>$1</code>')
  html = html.replace(new RegExp(`${UNICODE_FORMAT.QUOTE}(.+?)${UNICODE_FORMAT.QUOTE}`, 'g'), '<blockquote>$1</blockquote>')
  html = html.replace(
    new RegExp(`${UNICODE_FORMAT.SPOILER}(.+?)${UNICODE_FORMAT.SPOILER}`, 'g'),
    '<span class="spoiler-text" onclick="this.classList.toggle(\'revealed\')">$1</span>'
  )

  return emojiHtml(html)
}

const displayContent = computed(() => {
  if (isKeyEncrypted.value) {
    return resolvedText.value
  }
  if (isForward.value && forwardPayload.value) {
    return forwardPayload.value.c
  }
  return props.message.content
})

const formattedTime = computed(() => {
  const d = new Date(props.message.created_at)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const stickerFailed = ref(false)
const isContextMenuOpen = ref(false)
const showAllReactions = ref(false)
const menuPosition = ref({ top: 0, left: 0 })
const replyPreview = computed(() => {
  const original = props.replyMessage
  if (!original || original.deleted_for_all) return 'Сообщение недоступно'
  if (original.content.startsWith('sticker::')) return 'Стикер'
  if (original.content.startsWith('gift::')) return 'Подарок'
  if (isEncryptedMessage(original.content)) return '🔒 Зашифрованное сообщение'
  return original.content || 'Сообщение'
})

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '👎', '🥰', '👏', '😁']
const MORE_REACTIONS = ['😂', '🎉', '🤩', '😱', '🤔', '🤯', '🙏', '💯', '💩', '😍', '😭', '🤡', '🥳']

const reactionGroups = computed(() => {
  const raw = props.message.reactions
  const pairs = Array.isArray(raw) ? raw.map(r => [r.user_id, r.emoji] as const) : Object.entries(raw || {})
  const counts = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const [userId, emoji] of pairs) {
    if (!emoji) continue
    const item = counts.get(emoji) || { emoji, count: 0, mine: false }
    item.count++; if (userId === authStore.user?.id) item.mine = true; counts.set(emoji, item)
  }
  return [...counts.values()]
})
const bubbleElement = ref<HTMLElement | null>(null)
let bubbleResizeAnimation: Animation | undefined
watch(() => reactionGroups.value.map(reaction => `${reaction.emoji}:${reaction.count}`).join('|'), async () => {
  const bubble = bubbleElement.value
  if (!bubble || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const before = bubble.getBoundingClientRect()
  bubbleResizeAnimation?.cancel()
  bubble.classList.remove('reaction-resizing')
  await nextTick()
  if (bubbleElement.value !== bubble) return
  const after = bubble.getBoundingClientRect()
  if (!after.width || !after.height || (Math.abs(before.width - after.width) < 1 && Math.abs(before.height - after.height) < 1)) return
  bubble.style.setProperty('--reaction-bubble-color', getComputedStyle(bubble).backgroundColor)
  bubble.classList.add('reaction-resizing')
  const animation = bubble.animate(
    [{ transform: `scale(${before.width / after.width}, ${before.height / after.height})` }, { transform: 'scale(1, 1)' }],
    { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::before' },
  )
  bubbleResizeAnimation = animation
  animation.finished.then(() => {
    if (bubbleResizeAnimation === animation) bubble.classList.remove('reaction-resizing')
  }).catch(() => {})
}, { flush: 'pre' })
const reactionEffect = ref<{ emoji: string; x: number; y: number; id: number; image?: string } | null>(null)
const quickReactionEffects: Record<string, string> = {
  '👍': 'thumbs-up.webp', '❤': 'heart.webp', '🔥': 'fire.webp', '👎': 'thumbs-down.webp', '🥰': 'smiling-hearts.webp',
}
let reactionEffectTimer: ReturnType<typeof setTimeout> | undefined
let reactionEffectId = 0
const myReaction = computed(() => {
  const reactions = props.message.reactions
  const userId = authStore.user?.id
  if (!userId || !reactions) return ''
  return Array.isArray(reactions) ? reactions.find(item => item.user_id === userId)?.emoji || '' : reactions[userId] || ''
})
watch(myReaction, (emoji, previous) => {
  if (!emoji || emoji === previous || !bubbleElement.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const rect = bubbleElement.value.getBoundingClientRect()
  const file = quickReactionEffects[emoji.replace(/\uFE0F/g, '')]
  reactionEffect.value = { emoji, x: Math.max(65, Math.min(window.innerWidth - 65, rect.left + rect.width / 2)), y: Math.max(65, Math.min(window.innerHeight - 65, rect.top + rect.height / 2)), id: ++reactionEffectId, image: file ? `${import.meta.env.BASE_URL}reaction-effects/${file}` : undefined }
  if (reactionEffectTimer) clearTimeout(reactionEffectTimer)
  reactionEffectTimer = setTimeout(() => { reactionEffect.value = null }, file ? 2880 : 1100)
})
onUnmounted(() => { if (reactionEffectTimer) clearTimeout(reactionEffectTimer); bubbleResizeAnimation?.cancel() })
function onContextMenu(event: MouseEvent | KeyboardEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event instanceof MouseEvent ? event.clientX : rect.right
  const y = event instanceof MouseEvent ? event.clientY : rect.top
  menuPosition.value = { left: Math.max(8, Math.min(x - 270, window.innerWidth - 288)), top: Math.max(8, Math.min(y, window.innerHeight - 360)) }
  showAllReactions.value = false
  isContextMenuOpen.value = true
}

function handleReaction(emoji: string) {
  emit('reaction', { message: props.message, emoji })
  isContextMenuOpen.value = false
}

function copyMessageText() {
  navigator.clipboard.writeText(displayContent.value)
  isContextMenuOpen.value = false
}

let lastTap = 0
function handleBubbleClick() {
  const now = Date.now()
  if (now - lastTap < 300) {
    emit('double-tap', props.message)
  }
  lastTap = now
}
</script>

<template>
  <div class="message-row-wrapper">
    <!-- Centered Date Header if day changed -->
    <div v-if="dateSeparator" class="chat-date-sep">
      <span>{{ dateSeparator }}</span>
    </div>

    <!-- Service notice (join, leave, rename, photo, pin, unpin, clear) -->
    <div v-if="isService && servicePayload" class="svc-item">
      <div class="svc-pill">
        <span v-if="servicePayload.t === 'join'">
          {{ isMine ? 'Вы вступили в группу' : `${senderProfile?.name || 'Пользователь'} вступил(а) в группу` }}
        </span>
        <span v-else-if="servicePayload.t === 'leave'">
          {{ isMine ? 'Вы покинули группу' : `${senderProfile?.name || 'Пользователь'} покинул(а) группу` }}
        </span>
        <span v-else-if="servicePayload.t === 'rename'">
          {{ isMine ? 'Вы изменили название группы' : `${senderProfile?.name || 'Пользователь'} изменил(а) название группы` }}: «{{ servicePayload.q }}»
        </span>
        <span v-else-if="servicePayload.t === 'photo'">
          {{ isMine ? 'Вы обновили фото группы' : `${senderProfile?.name || 'Пользователь'} обновил(а) фото группы` }}
        </span>
        <span v-else-if="servicePayload.t === 'pin'">
          {{ isMine ? 'Вы закрепили сообщение' : `${senderProfile?.name || 'Пользователь'} закрепил(а) сообщение` }}
        </span>
        <span v-else-if="servicePayload.t === 'unpin'">
          {{ isMine ? 'Вы открепили сообщение' : `${senderProfile?.name || 'Пользователь'} открепил(а) сообщение` }}
        </span>
        <span v-else-if="servicePayload.t === 'clear'">
          История чата очищена
        </span>
      </div>
    </div>

    <!-- Standard Message Bubble Row -->
    <div
      v-else
      class="chat-bubble-row"
      :class="[
        { mine: isMine, 'sel-on': isSelected, 'reply-highlight': highlighted },
        `pos-${groupPosition}`,
        { 'anim-new': isNew },
      ]"
      tabindex="0"
      aria-label="Сообщение. Нажмите Shift и F10 для действий"
      @click="isSelectionMode && emit('select', message)"
      @keydown.enter.self.prevent="isSelectionMode && emit('select', message)"
      @keydown.space.self.prevent="isSelectionMode && emit('select', message)"
      @keydown.shift.f10.prevent="!isSelectionMode && onContextMenu($event)"
      @keydown.esc="isContextMenuOpen = false"
      @contextmenu.prevent="!isSelectionMode && onContextMenu($event)"
    >
      <!-- Selection Checkbox -->
      <button
        v-if="isSelectionMode"
        type="button"
        :aria-label="isSelected ? 'Снять выделение сообщения' : 'Выбрать сообщение'"
        :aria-pressed="isSelected"
        class="msg-checkbox"
        :class="{ checked: isSelected }"
        @click.stop="emit('select', message)"
      >
        <SolarIcon v-if="isSelected" name="check-read-bold" :size="12" color="#ffffff" />
      </button>

      <!-- Theirs avatar in group -->
      <div v-if="isGroup && !isMine" class="avatar-col">
        <button v-if="showAvatar" type="button" class="msg-avatar" :disabled="!senderProfile" :aria-label="`Открыть профиль ${senderProfile?.name || 'участника'}`" @click.stop="openSenderProfile">
          <img v-if="senderProfile?.avatar_url" :src="senderProfile.avatar_url" alt="" />
          <span v-else>{{ (senderProfile?.name || '?').charAt(0).toUpperCase() }}</span>
        </button>
        <div v-else class="msg-avatar-spacer" />
      </div>

      <div
        ref="bubbleElement"
        class="chat-bubble"
        :class="[
          { 'sticker-bubble': isSticker, 'gift-bubble': isGift, 'image-bubble': isImage, 'audio-bubble': isAudio },
          `pos-${groupPosition}`,
          { 'anim-in': isNew },
        ]"
        @click="!isSelectionMode && handleBubbleClick()"
      >
        <!-- Group Sender Name (shown on top of group only) -->
        <button v-if="isGroup && !isMine && senderProfile && showSenderName" type="button" class="gb-nm" @click.stop="openSenderProfile"><EmojiText :text="senderProfile.name" /></button>

      <!-- Forward Header -->
      <div v-if="isForward && forwardPayload" class="fwd-banner">
        <SolarIcon name="forward-linear" :size="12" color="#6db3ff" />
        <span class="fwd-author">Переслано от {{ forwardPayload.n }}</span>
      </div>

      <!-- Reply Quote -->
      <button v-if="message.reply_to" type="button" class="reply-preview" :disabled="!replyMessage" @click.stop="isSelectionMode ? emit('select', message) : emit('jump-to-reply', message.reply_to!)">
        <span class="reply-preview-author">{{ replyMessage ? replyAuthor : 'Ответ' }}</span>
        <span class="reply-preview-text"><EmojiText :text="replyPreview" /></span>
      </button>

      <!-- Sticker Image -->
      <div v-if="isSticker" class="sticker-wrap" role="button" tabindex="0" aria-label="Открыть набор стикеров" @click.stop="isSelectionMode ? emit('select', message) : emit('open-sticker-pack', message.content.slice(CONTENT_PREFIX.STICKER.length))" @keydown.enter.stop.prevent="isSelectionMode ? emit('select', message) : emit('open-sticker-pack', message.content.slice(CONTENT_PREFIX.STICKER.length))" @keydown.space.stop.prevent="isSelectionMode ? emit('select', message) : emit('open-sticker-pack', message.content.slice(CONTENT_PREFIX.STICKER.length))">
        <video v-if="!stickerFailed && isVideoSticker(stickerUrl)" :src="stickerUrl" class="sticker-img" autoplay loop muted playsinline aria-label="Стикер" @error="stickerFailed = true" /><img v-else-if="!stickerFailed" :src="stickerUrl" alt="Стикер" class="sticker-img" @error="stickerFailed = true" /><span v-else class="sticker-error">Стикер недоступен</span>
      </div>

      <!-- Gift Presentation -->
      <div v-else-if="isGift && giftPayload" class="gift-wrap">
        <div class="gift-icon-large"><GiftArt :gift-id="giftPayload.g" /></div>
        <div class="gift-title">Подарок: {{ giftInfo?.title || giftPayload.g }} ({{ giftPayload.p }} Qcoin)</div>
        <div v-if="giftPayload.m" class="gift-message">{{ giftPayload.m }}</div>
      </div>

      <!-- E2E Shield Notice -->
      <div v-else-if="isE2E" class="e2e-box">
        <SolarIcon name="shield-check-bold" :size="14" color="#4ade80" />
        <span class="e2e-text">Зашифрованное E2E сообщение</span>
      </div>

      <!-- Image Message Attachment -->
      <div v-else-if="isImage && imagePayload" class="msg-image-wrap" @click.stop="handleImageClick">
        <img :src="imagePayload.url" alt="Фотография" class="msg-image" loading="lazy" />
      </div>

      <!-- Audio / Music Message Attachment -->
      <div v-else-if="isAudio && audioPayload" class="msg-audio-card" @click.stop="handleToggleAudio">
        <button
          type="button"
          class="msg-audio-play-btn"
          :aria-label="isCurrentAudioPlaying ? 'Пауза' : 'Воспроизвести'"
          @click.stop="handleToggleAudio"
        >
          <span class="msg-audio-icon" :class="{ visible: !isCurrentAudioPlaying }"><SolarIcon name="play-bold" :size="18" color="#ffffff" /></span>
          <span class="msg-audio-icon" :class="{ visible: isCurrentAudioPlaying }"><SolarIcon name="pause-bold" :size="18" color="#ffffff" /></span>
        </button>
        <div class="msg-audio-info">
          <div class="msg-audio-title">{{ audioPayload.title }}</div>
          <div class="msg-audio-sub">
            <span>{{ audioPayload.artist || 'Музыка' }}</span>
            <span v-if="audioPayload.duration" class="msg-audio-dur">{{ Math.floor(audioPayload.duration / 60) }}:{{ (Math.floor(audioPayload.duration % 60)).toString().padStart(2, '0') }}</span>
          </div>
        </div>
      </div>

      <!-- Key Encrypted: Locked status -->
      <div v-else-if="isKeyEncrypted && isLockedEncrypted" class="key-enc-locked">
        <SolarIcon name="lock-keyhole-linear" :size="16" />
        <span class="enc-locked-label">Текст зашифрован</span>
      </div>

      <!-- Message Text with Unicode Delimiters Support (Decrypted or Plaintext) -->
      <div
        v-else
        class="chat-bubble-text"
        :class="{ 'key-enc-decrypted': isKeyEncrypted }"
        v-html="renderFormattedContent(displayContent)"
      ></div>

      <div class="bubble-footer" :class="{ 'with-reactions': reactionGroups.length }">
      <div v-if="reactionGroups.length" class="message-reactions"><button v-for="reaction in reactionGroups" :key="reaction.emoji" type="button" class="reaction-chip" :class="{ mine: reaction.mine }" :aria-label="`${reaction.emoji}: ${reaction.count}`" :aria-pressed="reaction.mine" @click.stop="emit('reaction', { message, emoji: reaction.emoji })"><EmojiText :text="reaction.emoji" /><span>{{ reaction.count }}</span></button></div>
      <!-- Metadata (pin, edited, time, read ticks) -->
      <div class="chat-bubble-meta">
        <span v-if="message.pinned_at" class="bubble-pin">
          <SolarIcon name="bookmark-bold" :size="11" />
        </span>
        <span v-if="message.edited_at" class="bubble-edited">изм.</span>
        <span class="bubble-time">{{ formattedTime }}</span>

        <span v-if="isMine" class="bubble-tick" :class="{ read: message.read_at || message.is_read }">
          <SolarIcon
            :name="message.read_at || message.is_read ? 'check-read-linear' : 'check-linear'"
            :size="13"
          />
        </span>
      </div>
      </div>
    </div>
  </div>

    <Teleport to="body">
      <div v-if="reactionEffect" :key="reactionEffect.id" class="reaction-effect" :style="{ left: `${reactionEffect.x}px`, top: `${reactionEffect.y}px` }" aria-hidden="true">
        <img v-if="reactionEffect.image" class="reaction-effect-animation" :src="reactionEffect.image" alt="" @error="reactionEffect.image = undefined" />
        <template v-else>
        <span class="reaction-effect-ring"></span>
        <span v-for="n in 12" :key="n" class="reaction-effect-particle" :style="{ '--angle': `${n * 30}deg`, '--distance': `${48 + (n % 3) * 14}px`, '--delay': `${(n % 3) * 25}ms` }"></span>
        <span v-for="n in 4" :key="`emoji-${n}`" class="reaction-effect-mini" :style="{ '--angle': `${n * 90 + 45}deg` }"><EmojiText :text="reactionEffect.emoji" /></span>
        </template>
        <span class="reaction-effect-emoji"><EmojiText :text="reactionEffect.emoji" /></span>
      </div>
    </Teleport>
    <!-- Context Menu Modal -->
    <Teleport to="body"><Transition name="message-menu">
    <div v-if="isContextMenuOpen" class="msg-menu-overlay" @click.stop="isContextMenuOpen = false" @keydown.esc.stop="isContextMenuOpen = false">
      <div class="msg-menu-box" :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }" role="menu" @click.stop>
        <!-- Floating Quick Reactions Bar -->
        <div class="mm-react-strip">
          <button
            v-for="rx in QUICK_REACTIONS"
            :key="rx"
            type="button"
            class="mm-rx"
            @click="handleReaction(rx)"
          >
            <EmojiText :text="rx" />
          </button>
          <button
            type="button"
            class="mm-rx mm-more"
            :aria-label="showAllReactions ? 'Свернуть реакции' : 'Больше реакций'"
            :aria-expanded="showAllReactions"
            @click="showAllReactions = !showAllReactions"
          >
            <SolarIcon :name="showAllReactions ? 'alt-arrow-up-linear' : 'alt-arrow-down-linear'" :size="16" />
          </button>
        </div>

        <div class="mm-extra" :class="{ open: showAllReactions }"><div class="mm-extra-inner"><div class="mm-extra-grid"><button v-for="rx in MORE_REACTIONS" :key="rx" type="button" class="mm-rx" :aria-label="rx" @click="handleReaction(rx)"><EmojiText :text="rx" /></button></div></div></div>

        <!-- Dropdown Menu Actions -->
        <div class="mm-actions-card">
          <button
            type="button"
            class="mm-action-item"
            @click="emit('reply', message); isContextMenuOpen = false"
          >
            <SolarIcon name="reply-linear" :size="18" />
            <span>Ответить</span>
          </button>

          <button
            type="button"
            class="mm-action-item"
            @click="emit('pin', message); isContextMenuOpen = false"
          >
            <SolarIcon name="pin-linear" :size="18" />
            <span>{{ message.pinned_at ? 'Открепить' : 'Закрепить' }}</span>
          </button>

          <button
            v-if="isMine && !isSticker"
            type="button"
            class="mm-action-item"
            @click="emit('edit', message); isContextMenuOpen = false"
          >
            <SolarIcon name="pen-linear" :size="18" />
            <span>Изменить</span>
          </button>

          <button
            type="button"
            class="mm-action-item"
            @click="copyMessageText"
          >
            <SolarIcon name="copy-linear" :size="18" />
            <span>Копировать текст</span>
          </button>

          <button
            type="button"
            class="mm-action-item"
            @click="emit('select', message); isContextMenuOpen = false"
          >
            <SolarIcon name="check-circle-linear" :size="18" />
            <span>Выбрать</span>
          </button>

          <button
            type="button"
            class="mm-action-item danger"
            @click="emit('delete', message); isContextMenuOpen = false"
          >
            <SolarIcon name="trash-bin-trash-linear" :size="18" color="#f87171" />
            <span style="color: #f87171;">Удалить</span>
          </button>
        </div>
      </div>
    </div>
    </Transition></Teleport>
  </div>
</template>

<style scoped>
.reaction-effect { position: fixed; z-index: 13000; width: 0; height: 0; pointer-events: none; }
.reaction-effect-animation { position: absolute; width: 240px; height: 240px; max-width: none; left: -120px; top: -120px; object-fit: contain; }
.reaction-effect-emoji, .reaction-effect-mini, .reaction-effect-ring, .reaction-effect-particle { position: absolute; left: 0; top: 0; }
.reaction-effect-emoji { display: grid; place-items: center; width: 66px; height: 66px; margin: -33px; font-size: 58px; line-height: 1; animation: reaction-emoji-pop 1.05s cubic-bezier(.2,.8,.2,1) both; filter: drop-shadow(0 5px 9px rgba(0,0,0,.2)); }
.reaction-effect-emoji :deep(.apple-emoji) { width: 100%; height: 100%; }
.reaction-effect-mini { width: 22px; height: 22px; margin: -11px; font-size: 20px; line-height: 1; animation: reaction-mini-fly 900ms ease-out both; }
.reaction-effect-mini :deep(.apple-emoji) { width: 100%; height: 100%; }
.reaction-effect-particle { width: 7px; height: 7px; margin: -3.5px; border-radius: 50%; background: #ffd76b; box-shadow: 0 0 7px rgba(255,190,85,.6); animation: reaction-particle-fly 850ms ease-out var(--delay) both; }
.reaction-effect-particle:nth-child(3n) { width: 5px; height: 5px; background: #ff9fbd; }
.reaction-effect-particle:nth-child(3n + 1) { background: #a9b9ff; }
.reaction-effect-ring { width: 45px; height: 45px; margin: -22.5px; border: 2px solid rgba(255,215,140,.8); border-radius: 50%; animation: reaction-ring 650ms ease-out both; }
@keyframes reaction-emoji-pop { 0% { opacity: 0; transform: scale(.25) rotate(-18deg); } 32% { opacity: 1; transform: scale(1.18) rotate(9deg); } 53% { transform: scale(.95) rotate(-4deg); } 72% { opacity: 1; transform: scale(1) rotate(0); } 100% { opacity: 0; transform: translateY(-24px) scale(.75); } }
@keyframes reaction-particle-fly { 0% { opacity: 0; transform: rotate(var(--angle)) translateX(18px) scale(.2); } 18% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--distance)) scale(.4); } }
@keyframes reaction-mini-fly { 0% { opacity: 0; transform: rotate(var(--angle)) translateX(16px) rotate(calc(-1 * var(--angle))) scale(.25); } 25% { opacity: .95; } 100% { opacity: 0; transform: rotate(var(--angle)) translateX(75px) rotate(calc(-1 * var(--angle))) scale(.7); } }
@keyframes reaction-ring { from { opacity: .8; transform: scale(.4); } to { opacity: 0; transform: scale(2.5); } }
:global(html[data-theme="light"]) .chat-bubble-row.mine .chat-bubble:not(.sticker-bubble) { background: #26262c; color: #fff; }
:global(html[data-theme="light"]) .chat-bubble-row.mine .chat-bubble:not(.sticker-bubble) .chat-bubble-meta { color: #c5c5cc; }
:global(html[data-theme="light"]) .chat-bubble-row:not(.mine) .chat-bubble .chat-bubble-meta { color: #686872; }

.message-row-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* Telegram Date Separator */
.chat-date-sep {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2-5) 0 var(--space-2);
  pointer-events: none;
  width: 100%;
}

.chat-date-sep span {
  font-size: var(--text-12);
  font-weight: 500;
  color: var(--muted);
  background-color: transparent;
  padding: var(--space-1) var(--space-2-5);
  border-radius: 0;
  border: none;
  box-shadow: none;
}

.svc-item {
  display: flex;
  justify-content: center;
  margin: var(--space-2-5) 0;
  width: 100%;
}

.svc-pill {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  padding: var(--space-1) 14px;
  border-radius: 14px;
  font-size: var(--text-12);
  color: #d1d5db;
  text-align: center;
}

.chat-bubble-row {
  display: flex;
  align-items: flex-end;
  position: relative;
  width: 100%;
  padding: 0 var(--space-4);
  box-sizing: border-box;
}

.chat-bubble-row.mine {
  justify-content: flex-end;
}

.chat-bubble-row:not(.mine) {
  justify-content: flex-start;
}

/* Telegram Dynamic Vertical Spacing */
.chat-bubble-row.pos-first,
.chat-bubble-row.pos-middle {
  padding-bottom: 2.5px;
}

.chat-bubble-row.pos-single,
.chat-bubble-row.pos-last {
  padding-bottom: 9px;
}

/* Bubble Base */
.chat-bubble {
  max-width: min(78%, 640px);
  min-width: 0;
  padding: var(--space-2) var(--space-3) var(--space-1-5) 14px;
  font-size: var(--text-14);
  line-height: 1.4;
  word-break: break-word;
  position: relative;
  display: inline-flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: border-radius 0.15s ease;
}

.chat-bubble-text { width: 100%; text-align: left; align-self: stretch; white-space: pre-wrap; overflow-wrap: anywhere; }
.chat-bubble.reaction-resizing { isolation: isolate; background-color: transparent !important; box-shadow: none; }
.chat-bubble.reaction-resizing::before { content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--reaction-bubble-color); box-shadow: 0 1px 3px rgba(0, 0, 0, .18); transform-origin: left top; pointer-events: none; }
.chat-bubble-row.mine .chat-bubble.reaction-resizing::before { transform-origin: right top; }

/* Outgoing Message (White in Quietly, Black text) */
.chat-bubble-row.mine .chat-bubble {
  background-color: #ffffff;
  color: #000000;
}

.chat-bubble-row.mine .chat-bubble .chat-bubble-meta {
  color: #71717a;
}

.chat-bubble-row.mine .chat-bubble .bubble-tick.read {
  color: #28a8ea;
}

/* Incoming Message (Dark surface #242429, White text) */
.chat-bubble-row:not(.mine) .chat-bubble {
  background-color: var(--surface, #242429);
  color: var(--text);
}

.chat-bubble-row:not(.mine) .chat-bubble .chat-bubble-meta {
  color: rgba(255, 255, 255, 0.5);
}

/* --- TELEGRAM BORDER RADIUS SYSTEM --- */

/* Outgoing (Mine, right-aligned) */
.chat-bubble-row.mine .chat-bubble.pos-single {
  border-radius: 18px 18px 4px 18px;
}

.chat-bubble-row.mine .chat-bubble.pos-first {
  border-radius: 18px 18px 4px 18px;
}

.chat-bubble-row.mine .chat-bubble.pos-middle {
  border-radius: 18px 4px 4px 18px;
}

.chat-bubble-row.mine .chat-bubble.pos-last {
  border-radius: 18px 4px 4px 18px;
}

/* Incoming (Theirs, left-aligned) */
.chat-bubble-row:not(.mine) .chat-bubble.pos-single {
  border-radius: 18px 18px 18px 4px;
}

.chat-bubble-row:not(.mine) .chat-bubble.pos-first {
  border-radius: 18px 18px 18px 4px;
}

.chat-bubble-row:not(.mine) .chat-bubble.pos-middle {
  border-radius: 4px 18px 18px 4px;
}

.chat-bubble-row:not(.mine) .chat-bubble.pos-last {
  border-radius: 4px 18px 18px 4px;
}

/* --- TELEGRAM SPRING ENTRANCE ANIMATION --- */
.chat-bubble-row.mine .chat-bubble.anim-in {
  animation: tgBubbleInMine 0.20s cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-origin: bottom right;
  will-change: transform, opacity;
}

.chat-bubble-row:not(.mine) .chat-bubble.anim-in {
  animation: tgBubbleInTheirs 0.20s cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-origin: bottom left;
  will-change: transform, opacity;
}
@media (prefers-reduced-motion: reduce) {
  .chat-bubble-row .chat-bubble.anim-in { animation: none; }
}

@keyframes tgBubbleInMine {
  0% {
    opacity: 0;
    transform: translateY(32px) scale(0.92);
  }
  60% {
    opacity: 1;
    transform: translateY(-2px) scale(1.015);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes tgBubbleInTheirs {
  0% {
    opacity: 0;
    transform: translateY(28px) scale(0.92);
  }
  60% {
    opacity: 1;
    transform: translateY(-2px) scale(1.015);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Avatar Column and Spacer */
.avatar-col {
  display: flex;
  align-items: flex-end;
  flex-shrink: 0;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: #3f3f46;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-14);
  font-weight: 700;
  color: #fff;
  margin-right: var(--space-2);
  flex-shrink: 0;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.msg-avatar-spacer {
  width: 32px;
  height: 32px;
  margin-right: var(--space-2);
  flex-shrink: 0;
}

.sticker-error { display: block; padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface); color: var(--text); font-size: var(--text-12); }

.sticker-bubble {
  background: transparent !important;
  color: var(--text) !important;
  box-shadow: none;
  padding: 0 !important;
}
.chat-bubble-row .chat-bubble.sticker-bubble .chat-bubble-meta {
  align-self: flex-end;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, .72);
  color: #fff;
  line-height: 1.4;
}
.chat-bubble-row .chat-bubble.sticker-bubble .bubble-tick { color: #fff; }
.chat-bubble-row .chat-bubble.sticker-bubble .bubble-tick.read { color: #b7cbff; }

.sticker-wrap { cursor: pointer; }
.sticker-wrap img, .sticker-wrap video {
  max-width: 160px;
  max-height: 160px;
  display: block;
}

/* Image Message */
.image-bubble {
  padding: 4px 4px 6px 4px !important;
  max-width: 320px;
  overflow: hidden;
}
.msg-image-wrap {
  cursor: pointer;
  border-radius: 14px;
  overflow: hidden;
  max-width: 312px;
  max-height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
}
.msg-image {
  width: 100%;
  height: 100%;
  max-height: 380px;
  object-fit: cover;
  display: block;
  border-radius: 14px;
  transition: opacity 0.15s;
}
.msg-image-wrap:hover .msg-image {
  opacity: 0.95;
}
.image-bubble .chat-bubble-meta {
  margin-top: 4px;
  padding-right: 6px;
}

/* Audio Message */
.audio-bubble {
  min-width: 240px;
  max-width: 320px;
  padding: 10px 14px !important;
}
.msg-audio-card {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}
.msg-audio-play-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #0a84ff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.15s;
}
.msg-audio-play-btn:hover {
  transform: scale(1.05);
}
.msg-audio-icon {
  position: absolute;
  display: flex;
  opacity: 0;
  transform: scale(.75);
  transition: opacity .18s ease, transform .18s ease;
}
.msg-audio-icon.visible {
  opacity: 1;
  transform: scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .msg-audio-icon { transition: none; }
}
.msg-audio-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.msg-audio-title {
  font-size: var(--text-14);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
}
.chat-bubble-row.mine .msg-audio-title {
  color: inherit;
}
:global(html[data-theme="light"]) .chat-bubble-row.mine .msg-audio-title {
  color: #20222a;
}
.chat-bubble-row:not(.mine) .msg-audio-title {
  color: var(--text);
}
.msg-audio-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--text-12);
  color: inherit;
  opacity: 0.75;
}
.chat-bubble-row.mine .msg-audio-sub {
  color: inherit;
}
:global(html[data-theme="light"]) .chat-bubble-row.mine .msg-audio-sub {
  color: #667080;
}
.chat-bubble-row:not(.mine) .msg-audio-sub {
  color: var(--muted);
  opacity: 1;
}
.msg-audio-dur {
  font-variant-numeric: tabular-nums;
}

.fwd-banner {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: var(--space-1);
}

.fwd-author {
  font-size: var(--text-12);
  font-weight: 600;
  color: #6db3ff;
}

.gift-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2-5);
  text-align: center;
}

.gift-icon-large { width: 112px; height: 112px; }

.gift-title {
  font-size: var(--text-14);
  font-weight: 700;
  margin-top: var(--space-1);
}

.gift-message {
  font-size: var(--text-12);
  margin-top: var(--space-1);
  color: #d1d5db;
}

.key-enc-locked {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px 0;
  color: #f87171;
  font-weight: 500;
  font-size: var(--text-14);
  user-select: none;
}
.enc-locked-label {
  letter-spacing: 0.2px;
}
.chat-bubble-row.mine .key-enc-locked {
  color: #dc2626;
}
:global(html:not([data-theme="light"]) .chat-bubble-row .key-enc-locked) { color: #ffd8dd; }
.key-enc-decrypted {
  display: block;
}
.e2e-box {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  font-size: var(--text-12);
  color: #4ade80;
}

.chat-bubble-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
  margin-top: var(--space-0-5);
  font-size: var(--text-12);
  color: rgba(255, 255, 255, 0.55);
}

.bubble-edited {
  font-size: var(--text-12);
}

.bubble-tick.read {
  color: #60a5fa;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: #3f3f46;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-14);
  font-weight: 700;
  color: #fff;
  align-self: flex-end;
  margin-right: var(--space-1-5);
  flex-shrink: 0;
}

.msg-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gb-nm {
  font-size: var(--text-12);
  font-weight: 700;
  color: #6db3ff;
  margin-bottom: 3px;
  align-self: stretch;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.reply-quote {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: var(--space-1) var(--space-2);
  margin-bottom: var(--space-1);
  cursor: pointer;
  border-left: 2px solid #4a63f0;
}

.rq-t b {
  font-size: var(--text-12);
  color: #4a63f0;
}

.msg-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--muted, #71717a);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  align-self: center;
  margin-right: var(--space-2-5);
}

.msg-checkbox.checked {
  background-color: #4a63f0;
  border-color: #4a63f0;
}

.chat-bubble-row.sel-on {
  background-color: transparent;
  border-radius: 12px;
}

/* Context Menu Overlay & Box */
.msg-menu-overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 10000;
}

.msg-menu-box {
  position: absolute;
  width: min(280px, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 210px;
}

.msg-menu-box.mine {
  right: 20px;
}

.msg-menu-box:not(.mine) {
  left: 20px;
}

.mm-react-strip {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 2px;
  padding: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.mm-rx {
  background: transparent;
  border: none;
  font-size: 18px;
  padding: 2px;
  border-radius: 8px;
  cursor: pointer;
}

.mm-rx:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: none;
}

.mm-actions-card {
  display: flex;
  flex-direction: column;
}

.mm-action-item {
  display: flex;
  align-items: center;
  gap: var(--space-2-5);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text);
  font-size: var(--text-14);
  cursor: pointer;
}

.mm-action-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.reply-preview { width: 100%; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 10px; margin-bottom: 6px; border-radius: 8px; background: rgba(90, 110, 160, .16); text-align: left; color: inherit; cursor: pointer; font: inherit; }
.reply-preview:disabled { cursor: default; }
.reply-preview-author { font-weight: 600; font-size: var(--text-12); }
.reply-preview-text { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-12); opacity: .8; }
.reply-highlight .chat-bubble { outline: 3px solid #6b8cff; outline-offset: 3px; }
.message-menu-enter-active, .message-menu-leave-active { transition: opacity .16s ease; }
.message-menu-enter-active .msg-menu-box, .message-menu-leave-active .msg-menu-box { transition: transform .16s ease; }
.message-menu-enter-from, .message-menu-leave-to { opacity: 0; }
.message-menu-enter-from .msg-menu-box, .message-menu-leave-to .msg-menu-box { transform: translateY(6px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .message-menu-enter-active, .message-menu-leave-active, .message-menu-enter-active .msg-menu-box, .message-menu-leave-active .msg-menu-box { transition: none; } }

.mm-extra { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .22s cubic-bezier(.2,.8,.2,1), opacity .18s ease; }
.mm-extra.open { grid-template-rows: 1fr; opacity: 1; }
.mm-extra-inner { overflow: hidden; min-height: 0; }
.mm-extra-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 2px; padding: 0 2px; }
.mm-extra:not(.open) { visibility: hidden; transition: grid-template-rows .22s cubic-bezier(.2,.8,.2,1), opacity .18s ease, visibility 0s linear .22s; }
.mm-rx { min-width: 0; min-height: 30px; }
.message-reactions { display: flex; align-self: flex-start; justify-content: flex-start; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.bubble-footer { display: contents; }
.bubble-footer.with-reactions { display: flex; align-self: stretch; align-items: end; justify-content: flex-start; flex-wrap: wrap; column-gap: 8px; }
.bubble-footer.with-reactions .message-reactions { flex: 0 1 auto; min-width: 0; margin-top: 2px; }
.bubble-footer.with-reactions .chat-bubble-meta { margin-left: auto; }
.reaction-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: rgba(100,115,150,.18); color: inherit; font: inherit; font-size: var(--text-12); cursor: pointer; animation: reaction-chip-in .2s ease-out both; transform-origin: left center; }
@keyframes reaction-chip-in { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .reaction-chip { animation: none; } }
.reaction-chip.mine { background: rgba(74,99,240,.3); }
@media (prefers-reduced-motion: reduce) { .mm-extra, .mm-extra:not(.open) { transition: none; } }
</style>
