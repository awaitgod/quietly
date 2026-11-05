<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore, type NavPane } from '../../stores/settings'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import SolarIcon from '../common/SolarIcon.vue'

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const groupsStore = useGroupsStore()

const totalUnread = computed(() => {
  return chatStore.totalUnreadCount + groupsStore.totalGroupUnread
})

function selectTab(tab: NavPane) {
  settingsStore.setPane(tab)
}
</script>

<template>
  <div class="tabbar-dock mobile-only">
    <nav class="tabbar">
      <button
        type="button"
        class="tab"
        :class="{ active: settingsStore.currentPane === 'search' }"
        @click="selectTab('search')"
      >
        <SolarIcon name="magnifer-linear" :size="24" />
      </button>

      <button
        type="button"
        class="tab"
        :class="{ active: settingsStore.currentPane === 'contacts' }"
        @click="selectTab('contacts')"
      >
        <SolarIcon name="users-group-two-rounded-linear" :size="24" />
      </button>

      <button
        type="button"
        class="tab"
        :class="{ active: settingsStore.currentPane === 'dm' }"
        @click="selectTab('dm')"
      >
        <SolarIcon name="chat-round-dots-linear" :size="24" />
        <span v-if="totalUnread > 0" class="tab-badge">
          {{ totalUnread > 99 ? '99+' : totalUnread }}
        </span>
      </button>

      <button
        type="button"
        class="tab"
        :class="{ active: settingsStore.currentPane === 'settings' }"
        @click="selectTab('settings')"
      >
        <SolarIcon name="settings-linear" :size="24" />
      </button>

      <button
        type="button"
        class="tab"
        :class="{ active: settingsStore.currentPane === 'profile' }"
        @click="selectTab('profile')"
      >
        <SolarIcon name="user-circle-linear" :size="24" />
      </button>
    </nav>
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .mobile-only {
    display: none !important;
  }
}

.tab-badge {
  position: absolute;
  top: 6px;
  right: calc(50% - 18px);
  min-width: 16px;
  min-height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background-color: #fff;
  color: #111;
  font-size: var(--text-12);
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
</style>
