<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { stickerForPartner, stickerUrl } from '../../utils/stickers'
import { OFFICIAL_PACKS, tablesApi } from '../../services/supabase'
import { useAuthStore } from '../../stores/auth'
import StickerPackPreview from '../modals/StickerPackPreview.vue'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import ChatHeader from './ChatHeader.vue'
import SelectionHeader from './SelectionHeader.vue'
import PinBar from './PinBar.vue'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import SolarIcon from '../common/SolarIcon.vue'
import type { Message } from '../../types'

const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const settingsStore = useSettingsStore()

const messageListRef = ref<any>(null)
const composerRef = ref<HTMLElement | null>(null)
const composerHeight = ref(64)
let composerObserver: ResizeObserver | undefined
onMounted(() => {
  if (!composerRef.value) return
  composerHeight.value = composerRef.value.offsetHeight
  composerObserver = new ResizeObserver(entries => { composerHeight.value = entries[0]?.target.clientHeight || 64 })
  composerObserver.observe(composerRef.value)
})
onUnmounted(() => composerObserver?.disconnect())

const isGroup = computed(() => !!groupsStore.activeGroup)
const joinError = ref('')
watch(() => groupsStore.activeGroup?.id, () => { joinError.value = '' })
async function joinGroup() {
  joinError.value = ''
  try { await groupsStore.joinGroup() }
  catch { joinError.value = 'Не удалось вступить в группу. Попробуйте ещё раз.' }
}

const messages = computed(() => {
  return isGroup.value ? groupsStore.groupMessages : chatStore.messages
})

const matches = computed(() => {
  const query = chatStore.searchQuery.trim().toLocaleLowerCase()
  return query ? messages.value.filter(message => message.content.toLocaleLowerCase().includes(query)) : []
})
const matchIndex = ref(0)
watch(() => chatStore.searchQuery, () => { matchIndex.value = Math.max(0, matches.value.length - 1); nextTick(() => { const m = matches.value[matchIndex.value]; if (m) messageListRef.value?.scrollToMessage(m.id) }) })
function moveSearch(step: number) {
  if (!matches.value.length) return
  matchIndex.value = (matchIndex.value + step + matches.value.length) % matches.value.length
  messageListRef.value?.scrollToMessage(matches.value[matchIndex.value].id)
}
const authStore = useAuthStore()
const stickerPack = ref<{ id: string; title: string; items: string[]; official: boolean } | null>(null)
const addedStickerPacks = ref<string[]>([])
const stickerPackError = ref('')
let stickerRequest = 0
function stickerPath(value: string) {
  try { return decodeURIComponent(new URL(value, window.location.origin).pathname).replace(/^\/+/, '') }
  catch { return value.replace(/^\/+/, '') }
}
async function openStickerPack(sticker: string) {
  const request = ++stickerRequest
  stickerPackError.value = ''
  stickerPack.value = null
  const path = stickerPath(sticker)
  const official = OFFICIAL_PACKS.find(pack => pack.items.some(item => path === stickerPath(item) || path.endsWith('/' + item)))
  if (official) {
    try {
      const saved = JSON.parse(localStorage.getItem(`chat_packs_added:${authStore.user?.id || 'guest'}`) || '["welcome"]')
      addedStickerPacks.value = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : ['welcome']
    } catch { addedStickerPacks.value = ['welcome'] }
    stickerPack.value = { ...official, official: true }
    return
  }
  try {
    const { data, error } = await tablesApi.stickerPacks.findPackByStickerUrl(sticker)
    if (error) throw error
    if (request !== stickerRequest) return
    const pack = data?.find(item => Array.isArray(item.items))
    if (!pack) { stickerPackError.value = 'Не удалось найти набор этого стикера.'; return }
    stickerPack.value = { id: String(pack.id), title: pack.title, items: pack.items, official: false }
  } catch { if (request === stickerRequest) stickerPackError.value = 'Не удалось загрузить набор стикеров. Попробуйте ещё раз.' }
}
function toggleStickerPack() {
  if (!stickerPack.value?.official) return
  const id = stickerPack.value.id
  const next = addedStickerPacks.value.includes(id) ? addedStickerPacks.value.filter(value => value !== id) : [...addedStickerPacks.value, id]
  try {
    localStorage.setItem(`chat_packs_added:${authStore.user?.id || 'guest'}`, JSON.stringify(next))
    addedStickerPacks.value = next
    window.dispatchEvent(new Event('quietly-sticker-packs-changed'))
  } catch { stickerPackError.value = 'Не удалось сохранить набор стикеров.' }
}
function sendStickerFromPack(sticker: string) {
  if (isGroup.value && groupsStore.membershipStatus !== 'member') return
  if (isGroup.value) void groupsStore.sendGroupMessage(`sticker::${sticker}`)
  else void chatStore.sendMessage(`sticker::${sticker}`)
  stickerPack.value = null
}
const suggestionAvailable = ref(true)
const currentConversationId = computed(() => String(groupsStore.activeGroup?.id || chatStore.activeChat?.id || ''))
const suggestedSticker = computed(() => stickerForPartner(currentConversationId.value))
watch(currentConversationId, () => { suggestionAvailable.value = true; chatStore.exitSelectionMode() })
function sendSuggestedSticker() {
  if (isGroup.value && groupsStore.membershipStatus !== 'member') return
  if (isGroup.value) groupsStore.sendGroupMessage(`sticker::${suggestedSticker.value}`)
  else chatStore.sendMessage(`sticker::${suggestedSticker.value}`)
}
const profilesMap = computed(() => {
  return isGroup.value ? groupsStore.groupProfiles : new Map()
})

function onReply(msg: Message) {
  chatStore.replyContext = msg
  chatStore.editContext = null
}

function onEdit(msg: Message) {
  chatStore.editContext = msg
  chatStore.replyContext = null
}

function onPin(msg: Message) {
  if (isGroup.value) {
    groupsStore.pinGroupMessage(msg, !msg.pinned_at)
  } else {
    chatStore.togglePinMessage(msg)
  }
}

function onDelete(msg: Message) {
  chatStore.deleteMessage(msg.id)
}

function onSelect(msg: Message) {
  if (chatStore.isSelectionMode) chatStore.toggleSelection(msg.id)
  else chatStore.startSelection(msg.id)
}

function onDoubleTap(msg: Message) {
  // Trigger user's double-tap emoji reaction
  const emoji = settingsStore.doubleTapEmoji || '❤️'
  onReaction({ message: msg, emoji })
}

const reactionError = ref('')
let errorTimer: ReturnType<typeof setTimeout> | undefined
async function onReaction(payload: { message: Message; emoji: string }) {
  try {
    reactionError.value = ''
    if (isGroup.value) await groupsStore.reactToGroupMessage(payload.message.id, payload.emoji)
    else await chatStore.reactToMessage(payload.message.id, payload.emoji)
  } catch (err) {
    reactionError.value = err instanceof Error && err.message.includes('недоступна') ? err.message : 'Не удалось сохранить реакцию. Попробуйте ещё раз.'
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { reactionError.value = '' }, 5000)
  }
}

function scrollToMessageId(id: string | number) {
  messageListRef.value?.scrollToMessage(id)
}


</script>

<template>
  <div class="chat-view">
    <!-- Chat Header -->
    <div class="header-container"><Transition name="header-switch"><div v-if="chatStore.isSelectionMode" key="selection" class="header-panel"><SelectionHeader :messages="messages" :is-group="isGroup" /></div><div v-else key="chat" class="header-panel"><ChatHeader :search-count="matches.length" :search-index="matchIndex" @search-next="moveSearch(1)" @search-prev="moveSearch(-1)" /></div></Transition></div>

    <div v-if="reactionError" class="reaction-notice" role="alert">{{ reactionError }}</div>
    <!-- Pinned Bar -->
    <PinBar @scroll-to-message="scrollToMessageId" />

    <!-- Message List (Virtual Scroll TanStack) -->
    <div v-if="messages.length === 0 && !(isGroup ? groupsStore.isGroupLoading : chatStore.isMessagesLoading)" class="chat-welcome">
      <template v-if="suggestionAvailable && (!isGroup || groupsStore.membershipStatus === 'member')"><img :src="stickerUrl(suggestedSticker)" alt="" @error="suggestionAvailable = false" /><p>Начните переписку со стикера</p><button type="button" @click="sendSuggestedSticker">Отправить стикер</button></template>
      <p v-else>Здесь пока нет сообщений. Напишите первое!</p>
    </div>
    <MessageList v-else
      ref="messageListRef"
      :key="`${authStore.user?.id || ''}:${isGroup ? 'group' : 'dm'}:${groupsStore.activeGroup?.id || chatStore.activeChat?.id || ''}`"
      :conversation-id="`${isGroup ? 'group' : 'dm'}:${groupsStore.activeGroup?.id || chatStore.activeChat?.id || ''}`"
      :loading="isGroup ? groupsStore.isGroupLoading : chatStore.isMessagesLoading"
      :messages="messages"
      :composer-height="composerHeight"
      :is-group="isGroup"
      :profiles-map="profilesMap"
      :selected-ids="chatStore.selectedMessageIds"
      :is-selection-mode="chatStore.isSelectionMode"
      @reply="onReply"
      @edit="onEdit"
      @pin="onPin"
      @delete="onDelete"
      @select="onSelect"
      @double-tap="onDoubleTap"
      @reaction="onReaction"
      @open-sticker-pack="openStickerPack"
    />

    <div v-if="stickerPackError" class="reaction-notice" role="alert" @click="stickerPackError = ''">{{ stickerPackError }}</div>
    <StickerPackPreview v-if="stickerPack" :pack="stickerPack" :official="stickerPack.official" :added="addedStickerPacks.includes(stickerPack.id)" @close="stickerPack = null" @toggle="toggleStickerPack" @select="sendStickerFromPack" />
    <!-- Chat Input -->
    <div ref="composerRef" class="composer-overlay">
      <ChatInput v-if="!isGroup || groupsStore.membershipStatus === 'member'" />
      <div v-else class="join-area">
        <p v-if="joinError" class="join-error" role="alert">{{ joinError }}</p>
        <p v-else-if="groupsStore.membershipStatus === 'error' && groupsStore.membershipError" class="join-error" role="alert">{{ groupsStore.membershipError }}</p>
        <button v-if="groupsStore.membershipStatus === 'not-member'" type="button" class="join-button" :disabled="groupsStore.isJoining" @click="joinGroup">{{ groupsStore.isJoining ? 'Вступаем…' : 'Вступить в группу' }}</button>
        <button v-else-if="groupsStore.membershipStatus === 'error'" type="button" class="join-button" @click="groupsStore.checkMembership()">Не удалось проверить участие. Повторить</button>
        <div v-else class="join-loading" role="status">Проверяем участие…</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-container { position:relative; height:var(--header-height); flex:none; z-index:25; }
.header-panel { position:absolute; inset:0; }
.header-switch-enter-active,.header-switch-leave-active { transition: opacity .18s cubic-bezier(.2,.8,.2,1), transform .18s cubic-bezier(.2,.8,.2,1); }
.header-switch-enter-from { opacity:0; transform:translateY(-5px); }
.header-switch-leave-to { opacity:0; transform:translateY(5px); }
.header-switch-leave-active { pointer-events:none; }
@media (prefers-reduced-motion: reduce) { .header-switch-enter-active,.header-switch-leave-active { transition:none; } }
.chat-welcome { flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--space-3); padding:var(--space-6); color:var(--muted); text-align:center; }
.chat-welcome img { width:128px; height:128px; object-fit:contain; }.chat-welcome p { margin:0; }.chat-welcome button { padding:var(--space-2) var(--space-4); border-radius:999px; background:var(--surface); color:var(--text); font:inherit; cursor:pointer; }

.reaction-notice { position:absolute; top:72px; left:50%; transform:translateX(-50%); z-index:30; padding:var(--space-3) var(--space-4); border-radius:var(--radius-md); background:var(--surface); color:var(--text); box-shadow:0 8px 24px rgba(0,0,0,.25); font-size:var(--text-14); }
.composer-overlay { position: absolute; left: 0; right: 0; bottom: 0; z-index: 20; pointer-events: none; }
.composer-overlay :deep(.chat-input-wrapper) { pointer-events: auto; }
.join-area { pointer-events: auto; padding: 10px 24px 18px; text-align: center; }
.join-button, .join-loading { width: 100%; min-height: 48px; border: 0; border-radius: 999px; padding: 10px 16px; background: var(--surface); color: var(--text); font: inherit; font-weight: 600; }
.join-button { cursor: pointer; }
.join-button:disabled { opacity: .6; cursor: wait; }
.join-error { color: #e76d7c; font-size: var(--text-13); }
.chat-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  padding: 0;
  margin: 0;
}

.sel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 14px;
  background-color: var(--surface);
  border-radius: 14px;
  margin: var(--space-1-5) var(--space-4);
  border-left: 3px solid #4a63f0;
}

.sel-count {
  font-size: var(--text-14);
  font-weight: 600;
  color: var(--text);
}

.sel-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  padding: var(--space-1-5) var(--space-3);
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
}

.sel-action-btn.danger {
  color: var(--danger);
}

.sel-action-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
}
</style>
