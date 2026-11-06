<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { usePresenceStore } from '../../stores/presence'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import { FAV_ID } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'
import SearchBar from './SearchBar.vue'
defineProps<{ searchCount?: number; searchIndex?: number }>()
const emit = defineEmits<{ (e: 'search-next'): void; (e: 'search-prev'): void }>()

const presence = usePresenceStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const settingsStore = useSettingsStore()

const isGroup = computed(() => !!groupsStore.activeGroup)

const chatTitle = computed(() => {
  if (isGroup.value) return groupsStore.activeGroup?.name || 'Группа'
  return chatStore.activeChat?.name || ''
})

const chatAvatar = computed(() => {
  if (isGroup.value) return groupsStore.activeGroup?.avatar_url
  return chatStore.activeChat?.avatar_url
})

watch(() => isGroup.value ? null : chatStore.activeChat?.id, (id, oldId) => {
  if (oldId) presence.unwatchUser(oldId)
  if (id) presence.watchUser(id)
}, { immediate: true })
onUnmounted(() => { if (!isGroup.value && chatStore.activeChat?.id) presence.unwatchUser(chatStore.activeChat.id) })
const userStatus = computed(() => chatStore.activeChat ? presence.statusFor(chatStore.activeChat.id) : { text: '', online: false })

const typingStatus = computed(() => {
  if (!isGroup.value && chatStore.activeChat) {
    if (chatStore.typingUsers.has(chatStore.activeChat.id)) {
      return 'печатает...'
    }
  }
  return ''
})

const subtitle = computed(() => {
  if (typingStatus.value && userStatus.value.online) return typingStatus.value
  if (isGroup.value) {
    const count = groupsStore.groupMembers.length || groupsStore.activeGroup?.members_count
    return count == null ? 'Группа' : `${count} ${pluralizeMembers(count)}`
  }
  if (chatStore.activeChat?.id === FAV_ID) {
    return 'Бот'
  }
  return userStatus.value.text
})

function pluralizeMembers(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'участник'
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'участника'
  return 'участников'
}

function handleBack() {
  if (isGroup.value) {
    groupsStore.activeGroup = null
  } else {
    chatStore.activeChat = null
  }
}

function handleHeaderClick() {
  if (isGroup.value && groupsStore.activeGroup) {
    settingsStore.openGroupInfo()
  } else if (chatStore.activeChat) {
    settingsStore.openUserProfile(chatStore.activeChat)
  }
}

function handleAvatarClick(e: MouseEvent) {
  e.stopPropagation()
  if (chatAvatar.value) {
    settingsStore.openImagePreview(chatAvatar.value, chatTitle.value)
  } else {
    handleHeaderClick()
  }
}

function toggleSearch() {
  chatStore.isSearchOpen = !chatStore.isSearchOpen
}
</script>

<template>
  <div class="chat-top">
    <SearchBar v-if="chatStore.isSearchOpen" :count="searchCount" :index="searchIndex" @next="emit('search-next')" @prev="emit('search-prev')" @close="chatStore.isSearchOpen = false" />
    <div v-else class="chat-top-left">
      <!-- Close / Back button (cross icon in dark circle) -->
      <button
        type="button"
        class="header-round-btn close-btn"
        aria-label="Закрыть"
        @click="handleBack"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- Active chat Avatar (Squircle for Favorites, Circle for others) -->
      <button
        type="button"
        aria-label="Информация о чате"
        class="chat-top-avatar"
        :class="{ 'is-fav': chatStore.activeChat?.id === FAV_ID }"
        @click.stop="handleAvatarClick"
      >
        <img v-if="chatAvatar" :src="chatAvatar" alt="" />
        <span v-else-if="chatStore.activeChat?.id === FAV_ID" class="fav-box">
          <SolarIcon name="bookmark-bold" :size="20" color="#ffffff" />
        </span>
        <span v-else-if="isGroup" class="grp-box">
          <SolarIcon name="users-group-rounded-bold" :size="20" color="#ffffff" />
        </span>
        <span v-else>{{ chatTitle.charAt(0).toUpperCase() }}</span>
      </button>

      <!-- Title & Subtitle ("Бот" for Favorites) -->
      <div class="chat-top-info" @click="handleHeaderClick">
        <div class="chat-top-name">{{ chatTitle }}</div>
        <div
          class="chat-top-status"
          :class="{ typing: !!typingStatus && userStatus.online, online: !isGroup && userStatus.online }"
        >
          <Transition name="status-change" mode="out-in"><span :key="subtitle">{{ subtitle }}</span></Transition>
        </div>
      </div>
    </div>

    <!-- Right: More options button (three vertical dots in dark circle) -->
    <div v-if="!chatStore.isSearchOpen" class="chat-top-right">
      <button
        type="button"
        class="header-round-btn more-btn"
        aria-label="Поиск по чату"
        @click="toggleSearch"
      >
        <SolarIcon name="menu-dots-bold" :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
:global(html[data-theme="light"]) .header-round-btn:hover { background: #e2e2e8; }

.chat-top {
  height: var(--header-height);
  min-height: var(--header-height);
  border-bottom: 1px solid var(--ui-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  background: transparent;
  box-sizing: border-box;
  width: 100%;
  flex-shrink: 0;
}

.chat-top-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.chat-top-right {
  display: flex;
  align-items: center;
  flex: none;
}

.header-round-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: var(--surface);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
  padding: 0;
  flex-shrink: 0;
}

.header-round-btn:hover {
  background: #282830;
}

.header-round-btn:active {
  transform: scale(0.93);
}

.chat-top-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #242428;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 0;
  padding: 0;
  flex-shrink: 0;
  font-family: Unbounded, Montserrat, sans-serif;
  font-size: var(--text-16);
  font-weight: 700;
  color: #fff;
}

.chat-top-avatar.is-fav {
  border-radius: 50%;
  background-color: #28a8ea;
}

.fav-box {
  width: 100%;
  height: 100%;
  background-color: #28a8ea;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grp-box {
  width: 100%;
  height: 100%;
  background-color: #5c62d6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-top-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat-top-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  cursor: pointer;
}

.chat-top-name {
  font-size: var(--text-16);
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-top-status {
  font-size: var(--text-12);
  color: var(--muted, #a1a1aa);
  line-height: 1.2;
}

.chat-top-status.online, .chat-top-status.typing {
  color: #3b82f6;
}

.status-change-enter-active, .status-change-leave-active { transition: opacity .16s ease, transform .16s ease; }
.status-change-enter-from { opacity: 0; transform: translateY(3px); }
.status-change-leave-to { opacity: 0; transform: translateY(-3px); }
.chat-top-status span { display: inline-block; }
@media (prefers-reduced-motion: reduce) { .status-change-enter-active, .status-change-leave-active { transition: none; } }
@media (min-width: 768px) { .chat-top { padding-left: var(--space-2); } }
</style>