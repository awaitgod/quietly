<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { Message, UserProfile } from '../../types'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useAuthStore } from '../../stores/auth'
import { useAudioStore } from '../../stores/audio'
import MessageItem from './MessageItem.vue'
import SolarIcon from '../common/SolarIcon.vue'
import { readChatScroll, saveChatScroll } from '../../utils/chatScroll'

const props = defineProps<{
  messages: Message[]
  isGroup?: boolean
  profilesMap?: Map<string, UserProfile>
  selectedIds?: Set<string | number>
  isSelectionMode?: boolean
  composerHeight?: number
  conversationId: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'reply', message: Message): void
  (e: 'edit', message: Message): void
  (e: 'pin', message: Message): void
  (e: 'delete', message: Message): void
  (e: 'select', message: Message): void
  (e: 'double-tap', message: Message): void
  (e: 'reaction', payload: { message: Message; emoji: string }): void
  (e: 'open-sticker-pack', sticker: string): void
}>()

const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()
const audioStore = useAudioStore()
const highlightedId = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined
const messagesById = computed(() => new Map(props.messages.map(m => [String(m.id), m])))
function authorOf(message?: Message) {
  if (!message) return 'Сообщение'
  if (message.sender_id === authStore.user?.id) return 'Вы'
  return props.profilesMap?.get(message.sender_id)?.name || chatStore.activeChat?.name || 'Участник'
}

const parentRef = ref<HTMLElement | null>(null)
const showScrollBottom = ref(false)
const scrollUserId = authStore.user?.id || ''
const scrollConversationId = props.conversationId
const savedPosition = scrollUserId ? readChatScroll(scrollUserId, scrollConversationId) : null
const restoringPosition = ref(true)
let restoreStarted = false
let restoreFrame = 0
let scrollSaveTimer: ReturnType<typeof setTimeout> | undefined
function savePosition() {
  if (restoringPosition.value || !scrollUserId || !parentRef.value) return
  const container = parentRef.value
  if (container.scrollHeight - container.clientHeight - container.scrollTop < 40) {
    saveChatScroll(scrollUserId, scrollConversationId, { atBottom: true })
    return
  }
  const top = container.getBoundingClientRect().top
  const row = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]')).find(item => item.getBoundingClientRect().bottom > top)
  if (row?.dataset.messageId) saveChatScroll(scrollUserId, scrollConversationId, { atBottom: false, messageId: row.dataset.messageId, offset: row.getBoundingClientRect().top - top })
}
function cancelRestoration() {
  if (restoreFrame) cancelAnimationFrame(restoreFrame)
  restoreFrame = 0
  restoringPosition.value = false
  restoreStarted = true
}
function onUserScrollStart() { stopPreservingScroll(); cancelRestoration() }
async function restorePosition() {
  if (restoreStarted || props.loading || !parentRef.value || !props.messages.length) return
  restoreStarted = true
  if (!savedPosition || savedPosition.atBottom) {
    scrollToBottom(false)
    await nextTick()
    restoreFrame = requestAnimationFrame(() => { restoreFrame = 0; restoringPosition.value = false; handleScroll() })
    return
  }
  const index = props.messages.findIndex(message => String(message.id) === savedPosition.messageId)
  if (index < 0) { scrollToBottom(false); await nextTick(); restoreFrame = requestAnimationFrame(() => { restoreFrame = 0; restoringPosition.value = false; handleScroll() }); return }
  rowVirtualizer.value.scrollToIndex(index, { align: 'start', behavior: 'auto' })
  await nextTick()
  const started = performance.now()
  let stableFrames = 0
  const align = () => {
    const container = parentRef.value
    if (!container || !restoringPosition.value) return
    const row = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]')).find(item => item.dataset.messageId === savedPosition.messageId)
    if (row) {
      const delta = row.getBoundingClientRect().top - container.getBoundingClientRect().top - savedPosition.offset
      container.scrollTop += delta
      stableFrames = Math.abs(delta) < 1 ? stableFrames + 1 : 0
    }
    if (stableFrames < 3 && performance.now() - started < 500) restoreFrame = requestAnimationFrame(align)
    else { restoreFrame = 0; restoringPosition.value = false; handleScroll() }
  }
  restoreFrame = requestAnimationFrame(align)
}
watch(() => [props.loading, props.messages.length] as const, () => { void nextTick(restorePosition) })
function onPageHide() { if (scrollSaveTimer) clearTimeout(scrollSaveTimer); savePosition() }
onBeforeUnmount(() => { onPageHide(); if (restoreFrame) cancelAnimationFrame(restoreFrame) })
let preserveFrame = 0
function stopPreservingScroll() { if (preserveFrame) cancelAnimationFrame(preserveFrame); preserveFrame = 0 }
watch(() => audioStore.isNowPlayingStripVisible, () => {
  stopPreservingScroll()
  const container = parentRef.value
  if (!container) return
  const top = container.getBoundingClientRect().top
  const row = Array.from(container.querySelectorAll<HTMLElement>('[data-index]')).find(item => item.getBoundingClientRect().bottom > top)
  if (!row) return
  const index = row.dataset.index
  const initialTop = row.getBoundingClientRect().top
  const started = performance.now()
  const preserve = () => {
    if (parentRef.value !== container || !row.isConnected || row.dataset.index !== index) { preserveFrame = 0; return }
    container.scrollTop += row.getBoundingClientRect().top - initialTop
    if (performance.now() - started < 360) preserveFrame = requestAnimationFrame(preserve)
    else preserveFrame = 0
  }
  preserveFrame = requestAnimationFrame(preserve)
}, { flush: 'sync' })
onUnmounted(stopPreservingScroll)

// Telegram Grouping Logic
function isSameCluster(m1?: Message, m2?: Message): boolean {
  if (!m1 || !m2) return false
  if (m1.content.startsWith('svc::') || m2.content.startsWith('svc::')) return false
  if (m1.sender_id !== m2.sender_id) return false

  // Max 5 minutes between grouped messages
  const t1 = new Date(m1.created_at).getTime()
  const t2 = new Date(m2.created_at).getTime()
  if (isNaN(t1) || isNaN(t2)) return false
  if (Math.abs(t1 - t2) > 5 * 60 * 1000) return false

  // Same calendar date
  return new Date(m1.created_at).toDateString() === new Date(m2.created_at).toDateString()
}

function getGroupPosition(index: number): 'single' | 'first' | 'middle' | 'last' {
  const current = props.messages[index]
  if (!current || current.content.startsWith('svc::')) return 'single'

  const prev = props.messages[index - 1]
  const next = props.messages[index + 1]

  const hasPrev = isSameCluster(current, prev)
  const hasNext = isSameCluster(current, next)

  if (!hasPrev && !hasNext) return 'single'
  if (!hasPrev && hasNext) return 'first'
  if (hasPrev && hasNext) return 'middle'
  return 'last'
}

function shouldShowAvatar(index: number): boolean {
  if (!props.isGroup) return false
  const pos = getGroupPosition(index)
  return pos === 'last' || pos === 'single'
}

function shouldShowSenderName(index: number): boolean {
  if (!props.isGroup) return false
  const pos = getGroupPosition(index)
  return pos === 'first' || pos === 'single'
}

function getDateSeparator(index: number): string | null {
  const curr = props.messages[index]
  if (!curr) return null
  if (index === 0) return formatDateSeparator(curr.created_at)

  const prev = props.messages[index - 1]
  if (!prev) return formatDateSeparator(curr.created_at)

  const d1 = new Date(curr.created_at).toDateString()
  const d2 = new Date(prev.created_at).toDateString()
  if (d1 !== d2) {
    return formatDateSeparator(curr.created_at)
  }
  return null
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return 'Сегодня'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function isNewMessage(id: string | number): boolean {
  return chatStore.newlyAddedId === id || groupsStore.newlyAddedId === id
}

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.messages.length,
    getItemKey: (index: number) => String(props.messages[index]?.id ?? index),
    getScrollElement: () => parentRef.value,
    estimateSize: () => 64,
    overscan: 10,
  }))
)

let prevLength = props.messages.length

watch(
  () => props.messages.length,
  (newLen) => {
    const isAppend = newLen === prevLength + 1
    prevLength = newLen
    if (!restoringPosition.value && !showScrollBottom.value) {
      nextTick(() => scrollToBottom(isAppend))
    }
  }
)

function scrollToBottom(smooth = false) {
  if (props.messages.length > 0 && rowVirtualizer.value) {
    rowVirtualizer.value.scrollToIndex(props.messages.length - 1, {
      align: 'end',
      behavior: smooth ? 'smooth' : 'auto',
    })
  }
  nextTick(() => {
    if (parentRef.value) {
      if (smooth) {
        parentRef.value.scrollTo({
          top: parentRef.value.scrollHeight,
          behavior: 'smooth',
        })
      } else {
        parentRef.value.scrollTop = parentRef.value.scrollHeight
      }
    }
  })
}

function handleScroll() {
  if (!parentRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = parentRef.value
  const distFromBottom = scrollHeight - (scrollTop + clientHeight)
  showScrollBottom.value = distFromBottom > 240
  if (!restoringPosition.value) {
    if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
    scrollSaveTimer = setTimeout(savePosition, 150)
  }
}

function scrollToMessage(id: string | number) {
  const idx = props.messages.findIndex((m) => String(m.id) === String(id))
  if (idx !== -1) {
    rowVirtualizer.value.scrollToIndex(idx, { align: 'center', behavior: 'auto' })
    highlightedId.value = String(id)
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => { highlightedId.value = null }, 1800)
  }
}

defineExpose({ scrollToBottom, scrollToMessage })

onMounted(() => {
  window.addEventListener('pagehide', onPageHide)
  void nextTick(restorePosition)
})
onUnmounted(() => window.removeEventListener('pagehide', onPageHide))
</script>

<template>
  <div class="message-list-area">
  <div v-if="restoringPosition" class="history-loading" role="status">Загружаем сообщения…</div>
  <div ref="parentRef" class="message-virtual-container" :class="{ 'is-restoring': restoringPosition }" :style="{ paddingBottom: `${(composerHeight || 0) + 16}px` }" tabindex="0" role="region" aria-label="История сообщений" @scroll="handleScroll" @wheel="onUserScrollStart" @pointerdown="onUserScrollStart" @touchstart="onUserScrollStart">
    <div
      class="virtual-track"
      :style="{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }"
    >
      <div
        v-for="virtualRow in rowVirtualizer.getVirtualItems()"
        :key="String(virtualRow.key)"
        :data-index="virtualRow.index"
        :data-message-id="String(messages[virtualRow.index].id)"
        :ref="(el) => rowVirtualizer.measureElement(el as HTMLElement)"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start}px)`,
        }"
      >
        <MessageItem
          :message="messages[virtualRow.index]"
          :reply-message="messagesById.get(String(messages[virtualRow.index].reply_to))"
          :reply-author="authorOf(messagesById.get(String(messages[virtualRow.index].reply_to)))"
          :highlighted="highlightedId === String(messages[virtualRow.index].id)"
          :sender-profile="profilesMap?.get(messages[virtualRow.index].sender_id)"
          :is-group="isGroup"
          :is-selected="selectedIds?.has(messages[virtualRow.index].id)"
          :is-selection-mode="isSelectionMode"
          :group-position="getGroupPosition(virtualRow.index)"
          :show-avatar="shouldShowAvatar(virtualRow.index)"
          :show-sender-name="shouldShowSenderName(virtualRow.index)"
          :date-separator="getDateSeparator(virtualRow.index)"
          :is-new="isNewMessage(messages[virtualRow.index].id)"
          @reply="emit('reply', $event)"
          @edit="emit('edit', $event)"
          @pin="emit('pin', $event)"
          @delete="emit('delete', $event)"
          @select="emit('select', $event)"
          @double-tap="emit('double-tap', $event)"
          @reaction="emit('reaction', $event)"
          @jump-to-reply="scrollToMessage"
          @open-sticker-pack="emit('open-sticker-pack', $event)"
        />
      </div>
    </div>

  </div>
    <!-- Floating Jump To Bottom Button -->
    <button
      v-if="showScrollBottom && !restoringPosition"
      type="button"
      class="scroll-bottom-btn"
      aria-label="Вниз"
      :style="{ bottom: `${(composerHeight || 0) + 8}px` }"
      @click="scrollToBottom(true)"
    >
      <SolarIcon name="alt-arrow-down-linear" :size="20" />
    </button>
  </div>
</template>

<style scoped>
.message-list-area { flex: 1; min-height: 0; position: relative; }
.history-loading { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: var(--text-14); pointer-events: none; }
.message-virtual-container.is-restoring { visibility: hidden; }
.message-virtual-container {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: var(--space-4) var(--space-6);
  min-height: 0;
  overscroll-behavior: contain;
}

@media (max-width: 767px) {
  .message-virtual-container { padding: var(--space-3) var(--space-2); }
}

.virtual-track {
  max-width: 900px;
  margin-inline: auto;
}

.scroll-bottom-btn {
  position: absolute;
  right: var(--space-6);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--surface);
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: transform 0.2s, background-color 0.2s;
}

@media (max-width: 767px) { .scroll-bottom-btn { right: var(--space-4); } }
.scroll-bottom-btn:hover {
  background-color: #2e2e34;
  transform: scale(1.05);
}
</style>
