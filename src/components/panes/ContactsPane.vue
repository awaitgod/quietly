<script setup lang="ts">
import { ref } from 'vue'
import { useContactsStore } from '../../stores/contacts'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import SolarIcon from '../common/SolarIcon.vue'
import VerifiedBadge from '../common/VerifiedBadge.vue'
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
const contactError = ref('')
const contactBusy = ref(false)
async function addContact(user: UserProfile) {
  contactBusy.value = true; contactError.value = ''
  try { await contactsStore.saveContact(user.id, user.name); isAddModalOpen.value = false; searchInput.value = ''; await contactsStore.search('') }
  catch { contactError.value = 'Не удалось сохранить контакт.' }
  finally { contactBusy.value = false }
}
async function removeContact(id: string) {
  if (!confirm('Удалить контакт?')) return
  try { await contactsStore.deleteContact(id) } catch { contactError.value = 'Не удалось удалить контакт.' }
}

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
              <span class="chat-item-name">{{ c.name || c.profile?.name }}<VerifiedBadge :profile="c.profile" /></span>
            </div>
            <div class="chat-item-row2">
              <span class="chat-item-preview">@{{ c.profile?.username }}</span>
            </div>
          </div>
        </button>
        <button type="button" class="contact-remove" aria-label="Удалить контакт" @click="removeContact(c.contact_id)">×</button>
      </li>

      <li v-if="contactsStore.contacts.length === 0" class="empty-chats">
        У вас пока нет сохранённых контактов.<br />
        Нажмите «+», чтобы добавить контакт по юзернейму.
      </li>
    </ul>
    <Teleport to="body"><div v-if="isAddModalOpen" class="contact-overlay" @click.self="isAddModalOpen = false"><section class="contact-dialog" role="dialog" aria-modal="true" aria-label="Добавить контакт"><h2>Добавить контакт</h2><input v-model="searchInput" placeholder="Юзернейм" aria-label="Юзернейм" @input="contactsStore.search(searchInput.replace(/^@/, ''))" /><p v-if="contactError" role="alert">{{ contactError }}</p><button v-for="user in contactsStore.searchResultsUsers" :key="user.id" class="contact-result" type="button" :disabled="contactBusy" @click="addContact(user)">{{ user.name }} · @{{ user.username }}</button><p v-if="searchInput && !contactsStore.isSearching && !contactsStore.searchResultsUsers.length">Ничего не найдено</p><button class="contact-close" type="button" @click="isAddModalOpen = false">Закрыть</button></section></div></Teleport>
    <p v-if="contactError && !isAddModalOpen" role="alert">{{ contactError }}</p>
  </div>
</template>

<style scoped>
.chat-list li { position: relative; }
.contact-remove { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border-radius: 50%; background: var(--surface); color: var(--muted); cursor: pointer; }
.contact-overlay { position: fixed; inset: 0; z-index: 12000; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.6); }
.contact-dialog { width: min(100%, 440px); max-height: 80dvh; overflow: auto; padding: 24px; border-radius: 24px; background: var(--card); color: var(--text); }
.contact-dialog h2 { margin: 0 0 16px; font-size: var(--text-20); }
.contact-dialog input { background: var(--surface); color: var(--text); }
.contact-result, .contact-close { width: 100%; margin-top: 8px; padding: 12px; border-radius: 14px; background: var(--surface); color: var(--text); text-align: left; cursor: pointer; }
.contacts-pane {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-6);
}

.contacts-pane .dm-top, .contacts-pane .chat-list {
  border-radius: 20px;
}
.contacts-pane .dm-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 0 12px;
  margin: 4px 0 8px;
}
.contacts-pane .chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  margin: 0;
}
@media (min-width: 768px) {
  .contacts-pane {
    padding: 4px var(--space-8) var(--space-10);
  }
  .contacts-pane .dm-top,
  .contacts-pane .chat-list {
    width: 100%;
    max-width: 640px;
    margin-left: auto;
    margin-right: auto;
  }
  .contacts-pane .chat-list {
    flex: 0 1 auto;
  }
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
