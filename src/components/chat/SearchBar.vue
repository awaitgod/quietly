<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'next'): void
  (e: 'prev'): void
  (e: 'close'): void
}>()

defineProps<{ count?: number; index?: number }>()
const chatStore = useChatStore()
const query = ref('')
const input = ref<HTMLInputElement | null>(null)
onMounted(() => nextTick(() => input.value?.focus()))

function handleInput() {
  chatStore.searchQuery = query.value
}

function handleClose() {
  chatStore.isSearchOpen = false
  chatStore.searchQuery = ''
  emit('close')
}
</script>

<template>
  <div class="chat-searchbar">
    <div class="search-input-wrap">
      <SolarIcon name="magnifer-linear" :size="18" color="var(--muted)" />
      <input
        ref="input"
        v-model="query"
        aria-label="Поиск по переписке"
        type="text"
        placeholder="Поиск по переписке..."
        @input="handleInput"
      />
    </div>

    <span v-if="query" class="search-count" role="status">{{ count ? `${(index || 0) + 1}/${count}` : '0' }}</span>
    <div class="search-controls">
      <button type="button" class="ctrl-btn" aria-label="Предыдущее" @click="emit('prev')">
        <SolarIcon name="alt-arrow-up-linear" :size="18" />
      </button>
      <button type="button" class="ctrl-btn" aria-label="Следующее" @click="emit('next')">
        <SolarIcon name="alt-arrow-down-linear" :size="18" />
      </button>
      <button type="button" class="ctrl-btn" aria-label="Закрыть" @click="handleClose">
        <SolarIcon name="close-circle-linear" :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-searchbar {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background-color: var(--surface);
  border-radius: 16px;
  margin: 0;
}

.search-input-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.search-input-wrap input {
  flex: 1;
  min-width: 0;
  padding: var(--space-1) 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: var(--text-14);
}

.search-count { flex: none; color: var(--muted); font-size: var(--text-12); font-variant-numeric: tabular-nums; }
.search-controls {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.ctrl-btn {
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

.ctrl-btn:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.08);
}

.chat-searchbar:has(input:focus-visible) { outline: 2px solid #fff; outline-offset: 2px; }
.chat-searchbar input:focus-visible { outline: none !important; box-shadow: none !important; }
</style>
