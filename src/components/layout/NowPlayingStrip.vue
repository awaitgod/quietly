<script setup lang="ts">
import { useAudioStore } from '../../stores/audio'
import SolarIcon from '../common/SolarIcon.vue'

const audioStore = useAudioStore()

function handleToggle(e: Event) {
  e.stopPropagation()
  audioStore.togglePlay()
}

function handleClose(e: Event) {
  e.stopPropagation()
  audioStore.stopNowPlaying()
}

function openPlayer() {
  audioStore.isPlayerModalOpen = true
}
</script>

<template>
  <div v-if="audioStore.isNowPlayingStripVisible && audioStore.currentTrack" id="npGlobal" class="np-strip">
    <button
      type="button"
      class="np-pp"
      aria-label="Играть или пауза"
      @click="handleToggle"
    >
      <SolarIcon
        :name="audioStore.isPlaying ? 'pause-circle-bold' : 'play-circle-bold'"
        :size="18"
      />
    </button>

    <div class="np-tx" @click="openPlayer">
      <div class="np-in run">
        <span class="np-seg">
          <b>{{ audioStore.currentTrack.title }}</b>
          <small> — {{ audioStore.currentTrack.artist }}</small>
        </span>
      </div>
    </div>

    <button
      type="button"
      class="np-x"
      aria-label="Закрыть"
      @click="handleClose"
    >
      <SolarIcon name="close-circle-linear" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.np-strip {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  height: 36px;
  padding: 0 var(--space-2) 0 var(--space-3);
  background: var(--surface);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text);
  font-size: var(--text-14);
  line-height: 1;
  overflow: hidden;
  box-sizing: border-box;
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 50;
}

.np-pp, .np-x {
  flex: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.np-x {
  color: #85858b;
}

.np-tx {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
  mask-image: linear-gradient(90deg, #000 calc(100% - 18px), transparent);
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 18px), transparent);
}

.np-in {
  display: inline-block;
  white-space: nowrap;
  animation: npRun 14s linear infinite;
}

.np-seg b {
  font-weight: 700;
}

.np-seg small {
  font-size: var(--text-14);
  color: #85858b;
  font-weight: 600;
}

@keyframes npRun {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>
