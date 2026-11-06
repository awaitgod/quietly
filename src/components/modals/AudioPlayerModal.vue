<script setup lang="ts">
import { useAudioStore } from '../../stores/audio'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const audioStore = useAudioStore()

function handleSeek(e: Event) {
  const target = e.target as HTMLInputElement
  audioStore.seek(Number(target.value))
}
</script>

<template>
  <div
    v-if="audioStore.isPlayerModalOpen && audioStore.currentTrack"
    class="tk-ov show"
    @click.self="audioStore.isPlayerModalOpen = false"
  >
    <div class="tk-sheet">
      <div class="tk-grab"></div>

      <!-- Cover -->
      <div class="tk-pcv">
        <img v-if="audioStore.currentTrack.cover_url" :src="audioStore.currentTrack.cover_url" alt="" />
        <SolarIcon v-else name="music-notes-linear" :size="48" color="#ffffff" />
      </div>

      <!-- Title & Artist -->
      <div class="tk-pt">{{ audioStore.currentTrack.title }}</div>
      <div class="tk-pa">{{ audioStore.currentTrack.artist }}</div>

      <!-- Progress bar -->
      <div class="tk-bar">
        <input
          type="range"
          class="tk-rg"
          min="0"
          :max="audioStore.duration || 100"
          step="0.1"
          :value="audioStore.currentTime"
          :style="{ '--p': `${audioStore.duration ? Math.min(100, Math.max(0, audioStore.currentTime / audioStore.duration * 100)) : 0}%` }"
          aria-label="Позиция воспроизведения"
          @input="handleSeek"
        />
        <div class="tk-times">
          <span>{{ audioStore.formatTime(audioStore.currentTime) }}</span>
          <span>{{ audioStore.formatTime(audioStore.duration) }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="tk-ctl">
        <button
          type="button"
          class="tk-cb"
          aria-label="Предыдущий"
          @click="audioStore.prevTrack"
        >
          <SolarIcon name="skip-previous-bold" :size="24" />
        </button>

        <button
          type="button"
          class="tk-cb big"
          aria-label="Играть или пауза"
          @click="audioStore.togglePlay"
        >
          <SolarIcon
            :name="audioStore.isPlaying ? 'pause-circle-bold' : 'play-circle-bold'"
            :size="32"
          />
        </button>

        <button
          type="button"
          class="tk-cb nx"
          aria-label="Следующий"
          @click="audioStore.nextTrack"
        >
          <SolarIcon name="skip-next-bold" :size="24" />
        </button>
      </div>

      <!-- Set favorite in profile -->
      <button
        type="button"
        class="tk-fav-btn"
        @click="audioStore.toggleFavoriteTrack(audioStore.currentTrack)"
      >
        <SolarIcon
          :name="audioStore.currentTrack.is_favorite ? 'star-bold' : 'star-linear'"
          :size="18"
          :color="audioStore.currentTrack.is_favorite ? '#f59e0b' : 'currentColor'"
        />
        <span>
          {{
            audioStore.currentTrack.is_favorite
              ? 'Убрать из профиля'
              : 'Поставить в профиль'
          }}
        </span>
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
  margin-bottom: var(--space-5);
}

.tk-pcv {
  width: 200px;
  height: 200px;
  border-radius: 28px;
  overflow: hidden;
  background-color: #0a84ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tk-pcv img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tk-pt {
  font-size: var(--text-20);
  font-weight: 700;
  color: #fff;
  margin-top: 18px;
  text-align: center;
}

.tk-pa {
  font-size: var(--text-14);
  color: var(--muted);
  margin-top: var(--space-1);
}

.tk-bar {
  width: 100%;
  margin-top: var(--space-5);
}

.tk-times {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-12);
  color: var(--muted);
  margin-top: var(--space-1);
}

.tk-ctl {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  margin-top: var(--space-4);
}

.tk-cb {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background-color: var(--surface);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tk-cb.big {
  width: 64px;
  height: 64px;
  background-color: #fff;
  color: #111;
}

.tk-fav-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: 22px;
  padding: var(--space-2) var(--space-4);
  border-radius: 999px;
  border: none;
  background-color: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
}
</style>
