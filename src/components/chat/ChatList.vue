<script setup lang="ts">
import EmojiText from '../common/EmojiText.vue'

import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import { FAV_ID } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'

const authStore = useAuthStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const settingsStore = useSettingsStore()

const totalUnread = computed(() => {
  return chatStore.totalUnreadCount + groupsStore.totalGroupUnread
})

const combinedChatList = computed(() => {
  const dms = chatStore.conversationList.map((item) => ({
    id: item.id,
    name: item.profile.name,
    username: item.profile.username,
    avatar_url: item.profile.avatar_url,
    lastMessage: item.lastMessage,
    unreadCount: item.unreadCount,
    isGroup: false,
    rawProfile: item.profile,
  }))

  const grps = groupsStore.groups.map((g) => ({
    id: `grp:${g.id}`,
    name: g.name,
    username: g.username || '',
    avatar_url: g.avatar_url,
    lastMessage: g.last_message || null,
    unreadCount: g.unread_count || 0,
    isGroup: true,
    rawGroup: g,
  }))

  return [...dms, ...grps].sort((a, b) => {
    // Favorite always on top if it has no messages
    if (a.id === FAV_ID) return -1
    if (b.id === FAV_ID) return 1
    const tA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0
    const tB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0
    return tB - tA
  })
})

function formatChatTime(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

function isMessageOutgoing(msg?: any): boolean {
  if (!msg || !authStore.user) return false
  return msg.sender_id === authStore.user.id
}

function isChatActive(chat: any): boolean {
  if (settingsStore.currentPane !== 'dm') return false
  if (chat.isGroup) {
    return String(groupsStore.activeGroup?.id || '') === String(chat.id).replace('grp:', '')
  }
  return String(chatStore.activeChat?.id || '') === String(chat.id)
}

function handleSelectChat(item: any) {
  if (item.isGroup && item.rawGroup) {
    chatStore.activeChat = null
    groupsStore.openGroup(item.rawGroup)
  } else if (item.rawProfile) {
    groupsStore.activeGroup = null
    chatStore.openChat(item.rawProfile)
  }
  settingsStore.setPane('dm')
}

function toggleDesktopMenu() {
  settingsStore.isDesktopMenuOpen = !settingsStore.isDesktopMenuOpen
}
</script>

<template>
  <div class="chat-list-pane" id="paneDm">
    <!-- Top Header Bar with Hamburger Menu & "Чаты" Title -->
    <div class="dm-top">
      <div class="dm-title-row">
        <button
          type="button"
          class="dm-hamburger-btn"
          aria-label="Меню"
          :aria-expanded="settingsStore.isDesktopMenuOpen"
          @click="toggleDesktopMenu"
        >
          <SolarIcon name="hamburger-menu-linear" :size="20" color="#ffffff" />
          <span v-if="totalUnread > 0" class="dsk-dot">{{ totalUnread > 99 ? '99+' : totalUnread }}</span>
        </button>
        <h2 class="pane-heading">Чаты</h2>
      </div>
    </div>

    <!-- Rounded Floating Chats Card Container -->
    <TransitionGroup tag="ul" name="chat-order" class="chat-list">
      <li v-for="chat in combinedChatList" :key="chat.id">
        <button
          type="button"
          class="chat-item"
          :class="{
            unread: chat.unreadCount > 0,
            active: isChatActive(chat),
          }"
          :aria-current="isChatActive(chat) ? 'true' : undefined"
          @click="handleSelectChat(chat)"
        >
          <!-- Squircle avatar for Favorites, Circle for other chats -->
          <div
            class="chat-item-avatar"
            :class="{ 'is-fav': chat.id === FAV_ID }"
          >
            <img v-if="chat.avatar_url" :src="chat.avatar_url" alt="" />
            <span v-else-if="chat.id === FAV_ID" class="fav-icon-box">
              <SolarIcon name="bookmark-bold" :size="20" color="#ffffff" />
            </span>
            <span v-else-if="chat.isGroup" class="grp-icon-box">
              <SolarIcon name="users-group-rounded-bold" :size="20" color="#ffffff" />
            </span>
            <span v-else>{{ chat.name.charAt(0).toUpperCase() }}</span>
          </div>

          <div class="chat-item-body">
            <div class="chat-item-row1">
              <span class="chat-item-name">{{ chat.name }}</span>
              <div v-if="chat.lastMessage" class="chat-item-meta">
                <!-- Read/Sent Checkmark for outgoing messages -->
                <span v-if="chat.id === FAV_ID || isMessageOutgoing(chat.lastMessage)" class="chat-item-tick">
                  <svg v-if="chat.id === FAV_ID || ('read_at' in chat.lastMessage && (chat.lastMessage as any).read_at)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L7 17l-5-5"></path>
                    <path d="M22 10l-7.5 7.5-3-3"></path>
                  </svg>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="chat-item-time">
                  {{ formatChatTime(chat.lastMessage.created_at) }}
                </span>
              </div>
            </div>

            <div class="chat-item-row2">
              <span class="chat-item-preview">
                <template v-if="chat.lastMessage">
                  <span v-if="isMessageOutgoing(chat.lastMessage)" class="preview-prefix">Вы: </span>
                  <span v-if="chat.lastMessage.content.startsWith('sticker::')">Стикер</span>
                  <span v-else-if="chat.lastMessage.content.startsWith('svc::')">Служебное уведомление</span>
                  <span v-else><EmojiText :text="chat.lastMessage.content" /></span>
                </template>
                <template v-else-if="chat.id === FAV_ID">
                  Ваши личные заметки
                </template>
                <template v-else>
                  Нет сообщений
                </template>
              </span>

              <span v-if="chat.unreadCount > 0" class="chat-item-badge">
                {{ chat.unreadCount > 99 ? '99+' : chat.unreadCount }}
              </span>
            </div>
          </div>
        </button>
      </li>

      <li v-if="combinedChatList.length === 0" key="empty-chats" class="empty-chats">
        У вас пока нет активных диалогов.<br />
        Используйте поиск или контакты, чтобы начать общение.
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
:global(html[data-theme="light"]) .chat-item.active { background: #e3e4eb; }
:global(html[data-theme="light"]) .chat-list { background: #fff; }
:global(html[data-theme="light"]) .dm-hamburger-btn:hover { background: #e2e2e8; }

.chat-order-move { transition: transform 200ms ease; }
@media (prefers-reduced-motion: reduce) { .chat-order-move { transition: none; } }
.chat-list-pane {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: transparent;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.dm-top {
  width: 100%;
  display: flex;
  align-items: center;
  height: var(--header-height);
  min-height: var(--header-height);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
  background-color: transparent;
  box-sizing: border-box;
}

.dm-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dm-hamburger-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: var(--surface);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s, transform 0.15s;
  padding: 0;
  flex-shrink: 0;
}

.dm-hamburger-btn:hover {
  background: #282830;
}

.dm-hamburger-btn:active {
  transform: scale(0.93);
}

.dsk-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 16px;
  min-height: 20px;
  padding: 0 5px;
  border-radius: 8px;
  background: #4a63f0;
  color: #fff;
  font-size: var(--text-12);
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  box-shadow: 0 0 0 2px #18181b;
}

.pane-heading {
  font-family: Unbounded, Montserrat, -apple-system, sans-serif;
  font-size: var(--page-title-size);
  font-weight: 700;
  margin: 0;
  color: var(--text);
  line-height: var(--page-title-line-height);
}

/* Floating Rounded Inset Card Container */
.chat-list {
  list-style: none;
  margin: var(--space-4) var(--space-2) var(--space-4) var(--space-4);
  padding: var(--space-2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.015);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #3a3a42 transparent;
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  flex: 1 1 0;
  min-height: 0;
  width: auto;
  box-sizing: border-box;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2-5) var(--space-3);
  border: none;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s ease;
  box-sizing: border-box;
}

.chat-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.chat-item.active {
  background-color: rgba(255, 255, 255, 0.08);
}

.chat-item-avatar {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  overflow: hidden;
  background-color: #242428;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Unbounded, Montserrat, sans-serif;
  font-size: var(--text-16);
  font-weight: 700;
  color: #d4d4d8;
}

.chat-item-avatar.is-fav {
  border-radius: 50%;
  background-color: #28a8ea;
}

.fav-icon-box {
  width: 100%;
  height: 100%;
  background-color: #28a8ea;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grp-icon-box {
  width: 100%;
  height: 100%;
  background-color: #5c62d6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-item-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-item-body {
  flex: 1;
  min-width: 0;
}

.chat-item-row1 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.chat-item-name {
  font-size: var(--text-14);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.chat-item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
}

.chat-item-tick {
  display: inline-flex;
  align-items: center;
  color: var(--muted, #a1a1aa);
  line-height: 1;
}

.chat-item-time {
  font-size: var(--text-12);
  color: var(--muted, #a1a1aa);
}

.chat-item-row2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: 3px;
}

.chat-item-preview {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-14);
  color: var(--muted, #a1a1aa);
}

.preview-prefix {
  color: var(--muted, #a1a1aa);
  font-weight: 500;
}

.chat-item.unread .chat-item-name {
  font-weight: 700;
}

.chat-item.unread .chat-item-preview {
  color: var(--text);
  font-weight: 500;
}

.chat-item-badge {
  flex: none;
  min-width: 19px;
  min-height: 20px;
  padding: 0 var(--space-1-5);
  border-radius: 999px;
  background-color: #fff;
  color: #111;
  font-size: var(--text-12);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.empty-chats {
  padding: 60px var(--space-5);
  font-size: var(--text-14);
  color: #75757c;
  text-align: center;
  line-height: 1.6;
}
</style>