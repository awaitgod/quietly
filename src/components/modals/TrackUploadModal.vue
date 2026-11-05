<script setup lang="ts">
import { ref } from 'vue'
import { useAudioStore } from '../../stores/audio'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const audioStore = useAudioStore()
const title = ref('')
const artist = ref('')
const audioFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)
const coverPreview = ref('')
const isUploading = ref(false)

function onAudioChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 30 * 1024 * 1024) {
    alert('Файл больше 30 МБ')
    return
  }
  audioFile.value = file
  if (!title.value) {
    title.value = file.name.replace(/\.[^.]+$/, '').slice(0, 40)
  }
}

function onCoverChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  coverFile.value = file
  coverPreview.value = URL.createObjectURL(file)
}

async function handleUpload() {
  if (!audioFile.value || isUploading.value) return
  isUploading.value = true

  try {
    await audioStore.uploadTrack(
      title.value.trim() || 'Без названия',
      artist.value.trim() || 'Неизвестный исполнитель',
      audioFile.value,
      coverFile.value || undefined
    )
    emit('close')
  } catch (err: any) {
    alert(err.message || 'Ошибка загрузки трека')
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="tk-ov show" @click.self="emit('close')">
    <div class="tk-sheet">
      <div class="tk-grab"></div>
      <h3 class="modal-title">Добавить трек</h3>

      <!-- Cover file input -->
      <label class="tk-cover">
        <img v-if="coverPreview" :src="coverPreview" alt="" />
        <SolarIcon v-else name="camera-add-linear" :size="38" color="#ffffff" />
        <input type="file" accept="image/*" hidden @change="onCoverChange" />
      </label>

      <!-- Title & Artist -->
      <div class="tk-field">
        <input v-model="title" type="text" placeholder="Название трека" maxlength="40" />
      </div>

      <div class="tk-field">
        <input v-model="artist" type="text" placeholder="Исполнитель" maxlength="40" />
      </div>

      <!-- Audio file input -->
      <label class="tk-btn">
        <SolarIcon name="music-notes-linear" :size="18" />
        <span>{{ audioFile ? audioFile.name : 'Выбрать аудиофайл' }}</span>
        <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden @change="onAudioChange" />
      </label>

      <!-- Submit button -->
      <button
        type="button"
        class="tk-btn tk-ok"
        :disabled="!audioFile || isUploading"
        @click="handleUpload"
      >
        {{ isUploading ? 'Загрузка...' : 'Готово' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tk-ov {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tk-sheet {
  width: 100%;
  max-width: 440px;
  background-color: #1c1d21;
  border-radius: 28px;
  padding: var(--space-4) 26px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tk-grab {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #5b5b63;
  margin-bottom: var(--space-4);
}

.modal-title {
  margin: 0 0 var(--space-5);
  font-family: Unbounded, sans-serif;
  font-size: var(--text-16);
  font-weight: 700;
  color: #fff;
}

.tk-cover {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #0a84ff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tk-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tk-field {
  width: 100%;
  max-width: 290px;
  height: 46px;
  margin-top: 14px;
  padding: 0 18px;
  border-radius: 999px;
  background: #242429;
  display: flex;
  align-items: center;
}

.tk-field input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: var(--text-14);
}

.tk-btn {
  width: 100%;
  max-width: 290px;
  height: 46px;
  margin-top: 14px;
  padding: 0 18px;
  border-radius: 999px;
  background: #242429;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--text-14);
  font-weight: 600;
  border: none;
}

.tk-ok {
  background-color: #fff;
  color: #111;
  font-family: Unbounded, sans-serif;
  margin-top: var(--space-6);
}
</style>
