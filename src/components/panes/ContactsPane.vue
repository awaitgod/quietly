<script setup lang="ts">
import { ref } from 'vue'
import { useContactsStore } from '../../stores/contacts'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import SolarIcon from '../common/SolarIcon.vue'
import type { UserProfile } from '../../types'

const emit = defineEmits<{
  (e: 'open-create-group'): void
}>()

const contactsStore = useContactsStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const settingsStore = useSettingsStore()

const isAddModalOpen = ref(false)
const searchInput = ref('')

function openContact(user?: UserProfile) {
  if (!user) return
  groupsStore.activeGroup = null
  chatStore.openChat(user)
  settingsStore.setPane('dm')
}
</script>

<template>
  <div class="contacts-pane">
    <div class="dm-top">
      <h2 class="pane-heading">Контакты</h2>
      <div class="top-actions">
        <button
          type="button"
          class="icon-action-btn"
          aria-label="Создать группу"
          @click="emit('open-create-group')"
        >
          <SolarIcon name="users-group-rounded-linear" :size="22" />
        </button>
        <button
          type="button"
          class="icon-action-btn"
          aria-label="Добавить контакт"
          @click="isAddModalOpen = true"
        >
          <SolarIcon name="user-plus-linear" :size="22" />
        </button>
      </div>
    </div>

    <ul class="chat-list">
      <li v-for="c in contactsStore.contacts" :key="c.id">
        <button type="button" class="chat-item" @click="openContact(c.profile)">
          <div class="chat-item-avatar">
            <img v-if="c.profile?.avatar_url" :src="c.profile.avatar_url" alt="" />
            <span v-else>{{ (c.name || c.profile?.name || '?').charAt(0).toUpperCase() }}</span>
          </div>
          <div class="chat-item-body">
            <div class="chat-item-row1">
              <span class="chat-item-name">{{ c.name || c.profile?.name }}</span>
            </div>
            <div class="chat-item-row2">
              <span class="chat-item-preview">@{{ c.profile?.username }}</span>
            </div>
          </div>
        </button>
      </li>

      <li v-if="contactsStore.contacts.length === 0" class="empty-chats">
        У вас пока нет сохранённых контактов.<br />
        Нажмите «+», чтобы добавить контакт по юзернейму.
      </li>
    </ul>
  </div>
</template>

<style scoped>
.contacts-pane {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-6);
}

.pane-heading {
  font-family: Unbounded, sans-serif;
  font-size: var(--page-title-size);
  font-weight: 700;
  margin: 0;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-action-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: var(--surface);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s;
}

.icon-action-btn:hover {
  background-color: #2e2e34;
  transform: scale(1.05);
}
</style>
