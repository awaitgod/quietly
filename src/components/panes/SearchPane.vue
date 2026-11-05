<script setup lang="ts">
import { ref } from 'vue'
import { useContactsStore } from '../../stores/contacts'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import SolarIcon from '../common/SolarIcon.vue'
import type { UserProfile, Group } from '../../types'

const contactsStore = useContactsStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()
const settingsStore = useSettingsStore()

const searchQuery = ref('')

function handleInput() {
  contactsStore.search(searchQuery.value)
}

function clearSearch() {
  searchQuery.value = ''
  contactsStore.search('')
}

function openUser(user: UserProfile) {
  groupsStore.activeGroup = null
  contactsStore.addRecentSearch({ ...user, k: 'u' })
  chatStore.openChat(user)
  settingsStore.setPane('dm')
}

function openGroup(group: Group) {
  chatStore.activeChat = null
  contactsStore.addRecentSearch({ ...group, k: 'g' })
  groupsStore.openGroup(group)
  settingsStore.setPane('dm')
}
</script>

<template>
  <div class="search-pane">
    <div class="pane-title">
      <h2 class="pane-heading">Поиск</h2>
    </div>

    <!-- Search Input -->
    <div class="search-wrap">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Поиск по юзернейму..." aria-label="Поиск по юзернейму"
        class="search-input"
        @input="handleInput"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="search-clear"
        aria-label="Очистить"
        @click="clearSearch"
      >
        <SolarIcon name="close-circle-linear" :size="16" />
      </button>
    </div>

    <!-- Frequent Contacts (when search empty) -->
    <div v-if="!searchQuery && contactsStore.frequentContacts.length > 0" class="sr-freq">
      <div class="sr-freq-row">
        <button
          v-for="u in contactsStore.frequentContacts"
          :key="u.id"
          type="button"
          class="sr-fq"
          @click="openUser(u)"
        >
          <div class="sr-fq-av">
            <img v-if="u.avatar_url" :src="u.avatar_url" alt="" />
            <span v-else>{{ u.name.charAt(0).toUpperCase() }}</span>
          </div>
          <span class="sr-fq-name">{{ u.name }}</span>
        </button>
      </div>
    </div>

    <p v-if="!searchQuery && !contactsStore.frequentContacts.length && !contactsStore.recentSearches.length" class="search-empty">Найдите пользователя по юзернейму.</p>

    <!-- Recent searches -->
    <div v-if="!searchQuery && contactsStore.recentSearches.length > 0" class="search-history">
      <div class="history-head">
        <span class="history-title">Недавние</span>
        <button type="button" class="history-clear" @click="contactsStore.clearRecentSearches">
          Очистить
        </button>
      </div>
      <ul class="history-list">
        <li v-for="item in contactsStore.recentSearches" :key="item.id" class="history-item">
          <button
            type="button"
            class="history-open"
            @click="item.k === 'g' ? openGroup(item) : openUser(item)"
          >
            <SolarIcon
              :name="item.k === 'g' ? 'users-group-rounded-linear' : 'user-circle-linear'"
              :size="20"
            />
            <span>{{ item.name }}</span>
          </button>
          <button
            type="button"
            class="history-remove"
            aria-label="Удалить"
            @click="contactsStore.removeRecentSearch(item.id)"
          >
            <SolarIcon name="close-circle-linear" :size="14" />
          </button>
        </li>
      </ul>
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery" class="search-results-wrap">
      <p v-if="contactsStore.isSearching" class="search-empty" role="status">Поиск…</p>
      <ul v-else class="search-results">
        <!-- Users -->
        <li v-for="u in contactsStore.searchResultsUsers" :key="u.id" class="search-item">
          <button type="button" class="search-open" @click="openUser(u)">
            <div class="search-avatar">
              <img v-if="u.avatar_url" :src="u.avatar_url" alt="" />
              <span v-else>{{ u.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="search-text">
              <div class="search-name">{{ u.name }}</div>
              <div class="search-user">@{{ u.username }}</div>
            </div>
          </button>
        </li>

        <!-- Public Groups -->
        <li v-for="g in contactsStore.searchResultsGroups" :key="g.id" class="search-item">
          <button type="button" class="search-open" @click="openGroup(g)">
            <div class="search-avatar">
              <img v-if="g.avatar_url" :src="g.avatar_url" alt="" />
              <span v-else>
                <SolarIcon name="users-group-rounded-bold" :size="20" color="#ffffff" />
              </span>
            </div>
            <div class="search-text">
              <div class="search-name">{{ g.name }}</div>
              <div class="search-user">@{{ g.username }} · группа</div>
            </div>
          </button>
        </li>

        <li
          v-if="
            contactsStore.searchResultsUsers.length === 0 &&
            contactsStore.searchResultsGroups.length === 0 &&
            !contactsStore.isSearching
          "
          class="empty-posts"
        >
          Ничего не найдено
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.search-pane {
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

.search-pane { padding: 0 var(--space-8) var(--space-10); }
.search-pane > * { width: min(100%, 640px); margin-inline: auto; flex-shrink: 0; }
.pane-title { height: var(--header-height); min-height: var(--header-height); display: flex; align-items: center; margin: 0 auto var(--space-4); padding: 0; }
.pane-heading { color: var(--text); font-size: var(--page-title-size); line-height: var(--page-title-line-height); }
.search-wrap { position: relative; }
.search-wrap .search-input { width: 100%; min-height: 48px; padding: var(--space-3) 48px var(--space-3) var(--space-4); background: var(--surface); color: var(--text); border-radius: var(--radius-lg); font-size: var(--text-16); }
.search-wrap .search-clear { position: absolute; top: 50%; right: var(--space-2); transform: translateY(-50%); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: transparent; color: var(--muted); cursor: pointer; }
.search-results-wrap, .search-history, .sr-freq { margin-top: var(--space-4); }
.search-results, .history-list { list-style: none; padding: var(--space-2); margin: 0; border-radius: var(--radius-lg); background: var(--card); }
.search-item, .history-item { margin: 0; padding: 0; background: transparent; border-radius: var(--radius-md); }
.search-item:hover { background: transparent; }
.search-open, .history-open { width: 100%; min-height: 64px; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); background: transparent; color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.search-open:hover, .history-open:hover { background: var(--surface); }
.search-avatar, .sr-fq-av { width: 44px; height: 44px; flex: none; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--surface); color: var(--text); }
.search-avatar img, .sr-fq-av img { width: 100%; height: 100%; object-fit: cover; }
.search-text { min-width: 0; }.search-name { color: var(--text); font-size: var(--text-14); font-weight: 600; overflow-wrap: anywhere; }.search-user { color: var(--muted); font-size: var(--text-14); }
.history-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }.history-title { color: var(--muted); font-weight: 600; }.history-clear, .history-remove { background: transparent; color: var(--muted); cursor: pointer; padding: var(--space-2); }.history-item { display: flex; align-items: center; }.history-open { flex: 1; min-width: 0; }
.sr-freq-row { display: flex; gap: var(--space-3); overflow-x: auto; }.sr-fq { min-width: 72px; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-2); border-radius: var(--radius-md); background: var(--card); color: var(--text); cursor: pointer; }.sr-fq-name { max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-empty, .empty-posts { padding: var(--space-4); color: var(--muted); font-size: var(--text-14); }
@media (max-width: 480px) { .search-pane { padding: 0 var(--space-4) var(--space-4); } }
</style>
