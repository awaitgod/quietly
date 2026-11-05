<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import SolarIcon from '../common/SolarIcon.vue'

const props = defineProps<{
  file: File | null
}>()

const emit = defineEmits<{
  (e: 'cropped', blob: Blob): void
  (e: 'close'): void
}>()

const stageRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const zoom = ref(1)
const posX = ref(0)
const posY = ref(0)
const isDragging = ref(false)
let startX = 0
let startY = 0

const imageSrc = ref('')

onMounted(() => {
  if (props.file) {
    imageSrc.value = URL.createObjectURL(props.file)
  }
})

onUnmounted(() => {
  if (imageSrc.value) {
    URL.revokeObjectURL(imageSrc.value)
  }
})

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  startX = e.clientX - posX.value
  startY = e.clientY - posY.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  posX.value = e.clientX - startX
  posY.value = e.clientY - startY
}

function onMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function handleDone() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx || !imageRef.value) return

  // Render centered with zoom and pan
  ctx.save()
  ctx.beginPath()
  ctx.arc(256, 256, 256, 0, Math.PI * 2)
  ctx.clip()

  const img = imageRef.value
  const scale = zoom.value
  const drawW = img.naturalWidth * scale
  const drawH = img.naturalHeight * scale
  const drawX = 256 - drawW / 2 + posX.value
  const drawY = 256 - drawH / 2 + posY.value

  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.restore()

  canvas.toBlob(
    (blob) => {
      if (blob) {
        emit('cropped', blob)
        emit('close')
      }
    },
    'image/jpeg',
    0.88
  )
}
</script>

<template>
  <div class="ph-ov app-overlay show center" @click.self="emit('close')">
    <div class="ph-wrap">
      <div
        ref="stageRef"
        class="ph-stage"
        :class="{ drag: isDragging }"
        style="width: 280px; height: 280px;"
        @mousedown="onMouseDown"
      >
        <img
          ref="imageRef"
          :src="imageSrc"
          alt=""
          class="ph-img"
          :style="{
            transform: `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${zoom})`,
          }"
          draggable="false"
        />
        <div class="ph-circle"></div>
      </div>

      <!-- Zoom Slider -->
      <div class="ph-zoom">
        <SolarIcon name="magnifer-linear" :size="16" />
        <input v-model.number="zoom" type="range" min="0.5" max="3" step="0.05" />
      </div>

      <!-- Actions -->
      <div class="ph-bar">
        <button type="button" class="ph-btn" @click="emit('close')">Отмена</button>
        <button type="button" class="ph-btn ph-ok" @click="handleDone">Готово</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ph-ov {
  background: rgba(0, 0, 0, 0.88);
  z-index: 100;
}

.ph-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.ph-stage {
  position: relative;
  overflow: hidden;
  background: #000;
  border-radius: 12px;
  cursor: grab;
  user-select: none;
}

.ph-stage.drag {
  cursor: grabbing;
}

.ph-img {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: none;
  transform-origin: center;
  pointer-events: none;
}

.ph-circle {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.65);
  border: 2px solid rgba(255, 255, 255, 0.8);
  pointer-events: none;
}

.ph-zoom {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 280px;
  color: var(--muted);
}

.ph-zoom input {
  flex: 1;
  accent-color: #fff;
  cursor: pointer;
}

.ph-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1-5);
  border-radius: 999px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ph-btn {
  height: 40px;
  padding: 0 var(--space-5);
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
}

.ph-ok {
  background-color: #fff;
  color: #111;
}
</style>
