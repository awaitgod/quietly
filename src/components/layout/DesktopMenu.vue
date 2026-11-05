<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { FAV_PROFILE } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'
import type { UserProfile } from '../../types'

const emit = defineEmits<{
  (e: 'open-create-group'): void
  (e: 'open-accounts'): void
}>()

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()

const totalUnread = computed(() => {
  return chatStore.totalUnreadCount + groupsStore.totalGroupUnread
})

function selectPane(pane: any) {
  settingsStore.setPane(pane)
  settingsStore.isDesktopMenuOpen = false
}

function openFavorite() {
  groupsStore.activeGroup = null
  settingsStore.setPane('dm')
  chatStore.openChat(FAV_PROFILE as UserProfile)
  settingsStore.isDesktopMenuOpen = false
}

function handleCreateGroup() {
  settingsStore.isDesktopMenuOpen = false
  emit('open-create-group')
}
</script>

<template>
  <div>
    <!-- Backdrop to close dropdown on click outside -->
    <div
      v-if="settingsStore.isDesktopMenuOpen"
      class="dsk-backdrop"
      @click="settingsStore.isDesktopMenuOpen = false"
    ></div>

    <!-- Dropdown Menu -->
    <div
      v-if="settingsStore.isDesktopMenuOpen"
      class="dsk-menu"
      role="menu"
    >
      <button
        type="button"
        class="dsk-item"
        :class="{ on: settingsStore.currentPane === 'dm' }"
        @click="selectPane('dm')"
      >
        <SolarIcon name="chat-round-dots-linear" :size="22" />
        <span>Чаты</span>
        <span v-if="totalUnread > 0" class="dsk-b">{{ totalUnread }}</span>
      </button>

      <button
        type="button"
        class="dsk-item"
        :class="{ on: settingsStore.currentPane === 'profile' }"
        @click="selectPane('profile')"
      >
        <SolarIcon name="user-circle-linear" :size="22" />
        <span>Профиль</span>
      </button>

      <button type="button" class="dsk-item" @click="settingsStore.isDesktopMenuOpen = false; emit('open-accounts')">
        <SolarIcon name="users-group-rounded-linear" :size="22" />
        <span>Аккаунты</span>
      </button>

      <button
        type="button"
        class="dsk-item"
        @click="openFavorite"
      >
        <SolarIcon name="bookmark-linear" :size="22" />
        <span>Избранное</span>
      </button>

      <button
        type="button"
        class="dsk-item"
        :class="{ on: settingsStore.currentPane === 'settings' }"
        @click="selectPane('settings')"
      >
        <SolarIcon name="settings-linear" :size="22" />
        <span>Настройки</span>
      </button>

      <button
        type="button"
        class="dsk-item"
        :class="{ on: settingsStore.currentPane === 'search' }"
        @click="selectPane('search')"
      >
        <SolarIcon name="magnifer-linear" :size="22" />
        <span>Поиск</span>
      </button>

      <button
        type="button"
        class="dsk-item"
        :class="{ on: settingsStore.currentPane === 'contacts' }"
        @click="selectPane('contacts')"
      >
        <SolarIcon name="users-group-two-rounded-linear" :size="22" />
        <span>Контакты</span>
      </button>

      <div class="dsk-sep"></div>

      <button
        type="button"
        class="dsk-item"
        @click="handleCreateGroup"
      >
        <SolarIcon name="users-group-rounded-linear" :size="22" />
        <span>Создать группу</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.dsk-menu-btn {
  display: none !important;
}

.dsk-backdrop {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: transparent;
}

.dsk-menu {
  display: block;
  position: fixed;
  left: 16px;
  top: calc(56px + var(--player-offset, 0px));
  transition: top 260ms cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 26;
  width: 268px;
  padding: var(--space-2);
  border-radius: 24px;
  background: rgba(32, 32, 38, 0.96);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  transform-origin: 20px -8px;
  animation: dskMenuIn 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
}

@media (prefers-reduced-motion: reduce) { .dsk-menu { transition: none; } }

@keyframes dskMenuIn {
  from {
    opacity: 0;
    transform: scale(0.88) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.dsk-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--space-3) 14px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: var(--text, #fff);
  font: inherit;
  font-size: var(--text-16);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
}

.dsk-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.dsk-item:active {
  transform: scale(0.97);
}

.dsk-item.on {
  background: rgba(255, 255, 255, 0.1);
}

.dsk-item .dsk-b {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1-5);
  border-radius: 10px;
  background: #fff;
  color: #111;
  font-size: var(--text-12);
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}

.dsk-sep {
  height: 1px;
  margin: var(--space-1-5) var(--space-2-5);
  background: rgba(255, 255, 255, 0.08);
}
</style>