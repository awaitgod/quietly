<script setup lang="ts">
import EmojiText from '../common/EmojiText.vue'

import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useSettingsStore } from '../../stores/settings'
import { useEconomyStore } from '../../stores/economy'
import SolarIcon from '../common/SolarIcon.vue'
import KillerFeaturesPane from './KillerFeaturesPane.vue'
import SecurityPane from './SecurityPane.vue'

const emit = defineEmits<{
  (e: 'open-legal', doc: 'terms' | 'policy'): void
  (e: 'open-upload-track'): void
  (e: 'open-gifts'): void
  (e: 'open-topup'): void
}>()

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const economyStore = useEconomyStore()

const currentSubView = ref<'main' | 'look' | 'sec' | 'devices' | 'badges' | 'features'>('main')

const profile = computed(() => authStore.profile)
const userEmail = computed(() => authStore.user?.email || authStore.emailDraft || '')

const quickReactionEmojis = ['👍', '❤️', '🔥', '👎', '🥰', '👏', '😁', '😂']

function selectDoubleTap(emoji: string | null) {
  settingsStore.setDoubleTapEmoji(emoji)
}

function handleLogout() {
  if (confirm('Вы уверены, что хотите выйти из профиля?')) {
    authStore.logout()
  }
}

</script>

<template>
  <div v-if="profile" class="settings-pane">
    <!-- SUBVIEW: MAIN SETTINGS (Screenshot 3) -->
    <div v-if="currentSubView === 'main'" class="st-view">
      <div class="dm-top">
        <h1 class="st-main-title">Настройки</h1>
      </div>

      <!-- Account Row with email -->
      <button
        type="button"
        class="st-profile-row"
        @click="settingsStore.setPane('profile')"
      >
        <div class="st-avatar-circle">
          <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="" />
          <span v-else>{{ profile.name.slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="st-profile-info">
          <div class="st-name">{{ profile.name }}</div>
          <div class="st-email">{{ userEmail }}</div>
        </div>
        <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
      </button>

      <!-- Main Menu Items List (Screenshot 3) -->
      <div class="st-list">
        <!-- Security -->
        <button
          type="button"
          class="st-row"
          @click="currentSubView = 'sec'"
        >
          <SolarIcon name="shield-check-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Безопасность</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>

        <!-- Devices -->
        <button
          type="button"
          class="st-row"
          @click="currentSubView = 'devices'"
        >
          <SolarIcon name="laptop-minimalistic-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Устройства</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>

        <!-- Appearance (Оформление) -->
        <button
          type="button"
          class="st-row"
          @click="currentSubView = 'look'"
        >
          <SolarIcon name="monitor-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Оформление</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>

        <!-- Badges -->
        <button
          type="button"
          class="st-row"
          @click="currentSubView = 'badges'"
        >
          <SolarIcon name="verified-check-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Значки</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>
        <!-- Killer Features (Киллер фичи) -->
        <button
          type="button"
          class="st-row"
          @click="currentSubView = 'features'"
        >
          <SolarIcon name="magic-stick-3-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Киллер фичи</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>


        <!-- Gifts (Подарки) -->
        <button
          type="button"
          class="st-row"
          @click="emit('open-gifts')"
        >
          <SolarIcon name="gift-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Подарки</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>

        <!-- Qcoin's -->
        <button
          type="button"
          class="st-row"
          @click="emit('open-topup')"
        >
          <SolarIcon name="dollar-minimalistic-linear" :size="24" color="#8e8e96" />
          <span class="st-row-label">Qcoin's</span>
          <SolarIcon name="alt-arrow-right-linear" :size="20" color="#75757e" />
        </button>
      </div>

      <!-- Logout Button -->
      <button type="button" class="logout-btn" @click="handleLogout">
        Выйти из профиля
      </button>
    </div>

    <!-- SUBVIEW: APPEARANCE (Оформление - Screenshot 5) -->
    <div v-else-if="currentSubView === 'look'" class="st-view">
      <div class="sg-head">
        <button
          type="button"
          class="back-circle"
          aria-label="Назад"
          @click="currentSubView = 'main'"
        >
          <SolarIcon name="alt-arrow-left-linear" :size="22" color="#ffffff" />
        </button>
        <h2 class="sg-title">Оформление</h2>
      </div>

      <div class="sg-sec">ТЕМА</div>
      <div class="theme-options" role="group" aria-label="Тема оформления">
        <button v-for="option in (['dark', 'light'] as const)" :key="option" type="button" class="theme-option" :class="{ selected: settingsStore.theme === option }" :aria-pressed="settingsStore.theme === option" @click="settingsStore.setTheme(option)">
          <SolarIcon :name="option === 'dark' ? 'moon-linear' : 'sun-2-linear'" :size="20" />
          {{ option === 'dark' ? 'Тёмная' : 'Светлая' }}
        </button>
      </div>
      <!-- Section: Реакция на двойной тап -->
      <div class="sg-sec">РЕАКЦИЯ НА ДВОЙНОЙ ТАП</div>
      <p class="sg-note">Ставится, когда дважды нажимаешь на сообщение</p>

      <div class="dtp-row">
        <button
          v-for="em in quickReactionEmojis"
          :key="em"
          type="button"
          class="dtp-btn"
          :class="{ active: settingsStore.doubleTapEmoji === em }"
          @click="selectDoubleTap(em)"
        >
          <span><EmojiText :text="em" /></span>
        </button>
        <button
          type="button"
          class="dtp-off-btn"
          :class="{ active: !settingsStore.doubleTapEmoji }"
          @click="selectDoubleTap(null)"
        >
          Выкл
        </button>
      </div>

      <!-- Section: Добавление треков -->
      <div class="sg-sec">ДОБАВЛЕНИЕ ТРЕКОВ</div>
      <p class="sg-note">Загружайте треки и слушайте прямо в мессенджере</p>
      <button
        type="button"
        class="tk-upload-btn"
        @click="emit('open-upload-track')"
      >
        Загрузить
      </button>

    </div>

      <!-- SUBVIEW: KILLER FEATURES (Киллер фичи) -->
    <KillerFeaturesPane v-else-if="currentSubView === 'features'" @back="currentSubView = 'main'" />


    <!-- SUBVIEW: SECURITY (Безопасность) -->
    <SecurityPane v-else-if="currentSubView === 'sec'" @back="currentSubView = 'main'" />

    <!-- SUBVIEW: DEVICES (Устройства) -->
    <div v-else-if="currentSubView === 'devices'" class="st-view">
      <div class="sg-head">
        <button
          type="button"
          class="back-circle"
          aria-label="Назад"
          @click="currentSubView = 'main'"
        >
          <SolarIcon name="alt-arrow-left-linear" :size="22" color="#ffffff" />
        </button>
        <h2 class="sg-title">Устройства</h2>
      </div>

      <div class="sg-card">
        <div class="dev-item">
          <SolarIcon name="laptop-minimalistic-linear" :size="32" color="#0a84ff" />
          <div class="dev-info">
            <div class="dev-name">Quietly Desktop Windows (Текущий сеанс)</div>
            <div class="dev-sub">Windows 11 Mica • Онлайн</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SUBVIEW: BADGES (Значки) -->
    <div v-else-if="currentSubView === 'badges'" class="st-view">
      <div class="sg-head">
        <button
          type="button"
          class="back-circle"
          aria-label="Назад"
          @click="currentSubView = 'main'"
        >
          <SolarIcon name="alt-arrow-left-linear" :size="22" color="#ffffff" />
        </button>
        <h2 class="sg-title">Значки</h2>
      </div>

      <div class="sg-card">
        <p class="sg-desc">
          Значки верификации и отличия аккаунта. Присваиваются за активность или официальный статус в сети Quietly.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(html[data-theme="light"]) .tk-upload-btn, :global(html[data-theme="light"]) .tk-play-circle { background: #e2e2e8; color: #17171b; }
:global(html[data-theme="light"]) .tk-play-circle svg { color: #17171b !important; }

.theme-options { display: flex; gap: var(--space-2); margin: var(--space-3) 0 var(--space-6); }
.theme-option { flex: 1; display: flex; justify-content: center; align-items: center; gap: 8px; min-height: 48px; border-radius: var(--radius-lg); background: var(--surface); color: var(--text); font: inherit; cursor: pointer; }
.theme-option.selected { background: var(--text); color: var(--bg); }
:global(html[data-theme="light"]) .back-circle svg { color: #17171b !important; }

.settings-pane {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-6) var(--space-8) var(--space-10);
}

.st-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  margin-inline: auto;
}

.st-main-title {
  font-family: Unbounded, sans-serif;
  font-size: var(--page-title-size);
  font-weight: 700;
  color: var(--text);
  margin: 0 0 var(--space-6);
  line-height: var(--page-title-line-height);
}

.st-profile-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: transparent;
  border: none;
  padding: var(--space-4);
  cursor: pointer;
  text-align: left;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-lg);
  background: var(--card);
  margin-bottom: var(--space-4);
}

.st-avatar-circle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Montserrat, sans-serif;
  font-size: var(--text-20);
  font-weight: 700;
  color: #ffffff;
  overflow: hidden;
}

.st-avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.st-profile-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-wrap: anywhere;
}

.st-name {
  font-family: Montserrat, sans-serif;
  font-size: var(--text-16);
  font-weight: 700;
  color: var(--text);
}

.st-email {
  font-size: var(--text-14);
  color: #8e8e96;
  margin-top: var(--space-0-5);
}

.st-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-lg);
  background: var(--card);
}

.st-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 52px;
  padding: var(--space-3);
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.st-row:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.st-row-label {
  flex: 1;
  font-size: var(--text-16);
  font-weight: 500;
  color: var(--text);
}

.sg-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 40px;
  margin: 0 0 var(--space-6);
}

.back-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s;
}

.back-circle:hover {
  opacity: 0.8;
}

.sg-title {
  font-family: Unbounded, sans-serif;
  font-size: var(--page-title-size);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.sg-sec {
  font-size: var(--text-12);
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #71717a;
  text-transform: uppercase;
  margin-top: 18px;
}

.sg-note {
  font-size: var(--text-14);
  color: #8e8e96;
  margin: var(--space-1) 0 14px;
}

.dtp-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.dtp-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: var(--text-20);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}

.dtp-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.dtp-btn.active {
  border-color: #0a84ff;
  background: rgba(10, 132, 255, 0.15);
}

.dtp-off-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: 999px;
  background: #0a84ff;
  border: none;
  color: #ffffff;
  font-size: var(--text-14);
  font-weight: 700;
  cursor: pointer;
}

.dtp-off-btn.active {
  background: #2563eb;
}

.tk-upload-btn {
  width: 100%;
  max-width: 320px;
  height: 44px;
  border-radius: 999px;
  background: #232328;
  border: none;
  color: #ffffff;
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.tk-upload-btn:hover {
  opacity: 0.9;
}

.tk-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2-5);
}

.tk-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--surface);
  padding: var(--space-2-5) 14px;
  border-radius: 16px;
}

.tk-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #0a84ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tk-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tk-title {
  font-size: var(--text-14);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tk-artist {
  font-size: var(--text-12);
  color: #71717a;
}

.tk-duration {
  font-size: var(--text-12);
  color: #71717a;
}

.tk-play-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #232328;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tk-empty {
  font-size: var(--text-14);
  color: #71717a;
  margin-top: var(--space-2);
}

.sg-card {
  background: var(--card);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2-5);
}

.sg-kv {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-14);
}

.sg-label {
  color: var(--muted);
}

.sg-val {
  color: var(--text);
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}

.sg-desc {
  font-size: var(--text-14);
  line-height: 1.5;
  color: var(--muted);
  margin: 0;
}

.dev-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dev-name {
  font-size: var(--text-14);
  font-weight: 600;
  color: var(--text);
}

.dev-sub {
  font-size: var(--text-12);
  color: #4ade80;
}

.logout-btn {
  margin-top: var(--space-6);
  background: transparent;
  border: none;
  color: #f87171;
  font-size: var(--text-14);
  font-weight: 600;
  padding: var(--space-2-5) var(--space-1);
  text-align: left;
  cursor: pointer;
}

.settings-pane { padding-top: 4px; }
.settings-pane .dm-top, .settings-pane .sg-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  height: 56px;
  min-height: 56px;
  margin: 0 0 var(--space-6);
  padding: 0 var(--space-4);
  border-radius: 20px;
  background: var(--card);
}
.settings-pane .st-main-title { margin: 0; }
.sg-card-spaced, .sg-links { margin-top: var(--space-4); }
.sg-links { display: flex; flex-direction: column; padding: var(--space-2); border: 1px solid var(--ui-border); border-radius: var(--radius-lg); background: var(--card); }
.sg-links .st-row { width: 100%; }
.sg-kv { gap: var(--space-4); }
.sg-label { flex: 1; min-width: 0; }
.st-profile-row:hover { background: var(--surface); }
@media (max-width: 480px) { .settings-pane { padding: 4px var(--space-4) var(--space-4); } .sg-kv { align-items: flex-start; } }
</style>
