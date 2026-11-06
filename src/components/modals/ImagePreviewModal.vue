<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import SolarIcon from '../common/SolarIcon.vue'

const settingsStore = useSettingsStore()

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    settingsStore.closeImagePreview()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Transition name="img-preview-fade">
    <div
      v-if="settingsStore.previewImageSrc"
      class="img-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      @click.self="settingsStore.closeImagePreview()"
    >
      <!-- Top Bar -->
      <div class="img-preview-topbar">
        <div class="img-preview-title">
          {{ settingsStore.previewImageTitle || 'Фотография' }}
        </div>
        <button
          type="button"
          class="img-preview-close"
          aria-label="Закрыть просмотр"
          @click="settingsStore.closeImagePreview()"
        >
          <SolarIcon name="close-circle-linear" :size="28" color="#ffffff" />
        </button>
      </div>

      <!-- Main Image Container -->
      <div class="img-preview-stage" @click.self="settingsStore.closeImagePreview()">
        <img
          :src="settingsStore.previewImageSrc"
          :alt="settingsStore.previewImageTitle || 'Изображение'"
          class="img-preview-element"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.img-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  user-select: none;
}

.img-preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  width: 100%;
  flex-shrink: 0;
  z-index: 2;
}

.img-preview-title {
  color: #ffffff;
  font-family: Unbounded, Montserrat, sans-serif;
  font-size: var(--text-16);
  font-weight: 600;
  letter-spacing: 0.2px;
  max-width: 80%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.img-preview-close {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s, transform 0.15s;
}

.img-preview-close:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: scale(1.05);
}

.img-preview-close:active {
  transform: scale(0.95);
}

.img-preview-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 0;
}

.img-preview-element {
  max-width: min(92vw, 840px);
  max-height: min(84vh, 840px);
  object-fit: contain;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
  animation: zoomImgIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes zoomImgIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.img-preview-fade-enter-active,
.img-preview-fade-leave-active {
  transition: opacity 0.2s ease;
}

.img-preview-fade-enter-from,
.img-preview-fade-leave-to {
  opacity: 0;
}
</style>
