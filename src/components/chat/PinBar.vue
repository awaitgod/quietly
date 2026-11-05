<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'scroll-to-message', messageId: string | number): void
}>()

const chatStore = useChatStore()
const groupsStore = useGroupsStore()

const isGroup = computed(() => !!groupsStore.activeGroup)

const pins = computed(() => {
  return isGroup.value ? groupsStore.pinnedGroupMessages : chatStore.pinnedMessages
})

const activeIndex = computed(() => {
  return isGroup.value ? groupsStore.activeGroupPinIndex : chatStore.activePinIndex
})

const currentPin = computed(() => {
  if (pins.value.length === 0) return null
  return pins.value[activeIndex.value] || pins.value[0]
})

function handleClick() {
  if (!currentPin.value) return
  emit('scroll-to-message', currentPin.value.id)

  // Cycle through pinned messages if multiple
  if (pins.value.length > 1) {
    if (isGroup.value) {
      groupsStore.activeGroupPinIndex = (groupsStore.activeGroupPinIndex + 1) % pins.value.length
    } else {
      chatStore.activePinIndex = (chatStore.activePinIndex + 1) % pins.value.length
    }
  }
}

function handleUnpin(e: Event) {
  e.stopPropagation()
  if (!currentPin.value) return
  if (isGroup.value) {
    groupsStore.pinGroupMessage(currentPin.value, false)
  } else {
    chatStore.togglePinMessage(currentPin.value)
  }
}
</script>

<template>
  <div v-if="currentPin" class="chat-pinbar" @click="handleClick">
    <div class="pin-icon">
      <SolarIcon name="bookmark-bold" :size="18" color="#4a63f0" />
    </div>

    <div class="pin-body">
      <div class="pin-title">
        Закреплённое сообщение
        <span v-if="pins.length > 1">#{{ activeIndex + 1 }}</span>
      </div>
      <div class="pin-sub">
        <span v-if="currentPin.content.startsWith('sticker::')">Стикер</span>
        <span v-else>{{ currentPin.content }}</span>
      </div>
    </div>

    <button type="button" class="pin-x" aria-label="Открепить" @click="handleUnpin">
      <SolarIcon name="close-circle-linear" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.chat-pinbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 14px;
  background-color: var(--surface);
  border-radius: 14px;
  margin: var(--space-1-5) 0;
  cursor: pointer;
  border-left: 3px solid #4a63f0;
  transition: background-color 0.2s;
}

.chat-pinbar:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.pin-body {
  flex: 1;
  min-width: 0;
}

.pin-title {
  font-size: var(--text-12);
  font-weight: 600;
  color: #4a63f0;
}

.pin-sub {
  font-size: var(--text-14);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.pin-x {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pin-x:hover {
  color: #fff;
}
</style>
