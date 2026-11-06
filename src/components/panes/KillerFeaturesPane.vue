<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{ (event: 'back'): void }>()
const settingsStore = useSettingsStore()

const inputKey = ref(settingsStore.encryptionKey)
const showKey = ref(false)
const savedBanner = ref(false)

function toggleEnabled() {
  const next = !settingsStore.encryptionEnabled
  settingsStore.setEncryptionEnabled(next)
}

function saveKey() {
  settingsStore.setEncryptionKey(inputKey.value)
  savedBanner.value = true
  setTimeout(() => {
    savedBanner.value = false
  }, 2000)
}

function clearKey() {
  inputKey.value = ''
  settingsStore.setEncryptionKey('')
  savedBanner.value = true
  setTimeout(() => {
    savedBanner.value = false
  }, 2000)
}
</script>

<template>
  <div class="st-view">
    <div class="sg-head">
      <button
        type="button"
        class="back-circle"
        aria-label="Назад"
        @click="emit('back')"
      >
        <SolarIcon name="alt-arrow-left-linear" :size="22" color="#ffffff" />
      </button>
      <h2 class="sg-title">Киллер фичи</h2>
    </div>

    <!-- Feature 1: Key Encryption Section -->
    <div class="sg-sec">ШИФРОВАНИЕ</div>
    <p class="sg-note">
      Защита переписки секретным ключом. Установите одинаковый ключ на двух устройствах, чтобы общаться конфиденциально.
    </p>

    <!-- Main Switch Card -->
    <div class="sg-card">
      <div class="sg-kv">
        <div class="feat-info">
          <div class="feat-title">Шифрование ключом</div>
          <div class="feat-desc">
            Шифровать исходящие текстовые сообщения с помощью AES-GCM
          </div>
        </div>
        <button
          type="button"
          class="switch-btn"
          :class="{ active: settingsStore.encryptionEnabled }"
          role="switch"
          :aria-checked="settingsStore.encryptionEnabled"
          @click="toggleEnabled"
        >
          <span class="switch-thumb"></span>
        </button>
      </div>

      <!-- Key input & settings when enabled or configuring -->
      <div class="feat-divider"></div>

      <div class="feat-key-area">
        <label class="field-label">
          <span>Секретный ключ</span>
          <div class="input-with-icon">
            <input
              v-model="inputKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="Введите секретную фразу или ключ..."
              class="feat-input"
              @keydown.enter="saveKey"
            />
            <button
              type="button"
              class="eye-btn"
              :aria-label="showKey ? 'Скрыть ключ' : 'Показать ключ'"
              @click="showKey = !showKey"
            >
              <SolarIcon :name="showKey ? 'eye-closed-linear' : 'eye-linear'" :size="20" color="#8e8e96" />
            </button>
          </div>
        </label>

        <div class="feat-actions">
          <button
            type="button"
            class="save-btn"
            :disabled="inputKey === settingsStore.encryptionKey"
            @click="saveKey"
          >
            Сохранить ключ
          </button>
          <button
            v-if="inputKey || settingsStore.encryptionKey"
            type="button"
            class="clear-btn"
            @click="clearKey"
          >
            Очистить
          </button>
        </div>

        <div v-if="savedBanner" class="feat-banner success">
          <SolarIcon name="check-circle-bold" :size="16" color="#4ade80" />
          <span>Ключ сохранён</span>
        </div>
      </div>
    </div>

    <!-- How it works card -->
    <div class="sg-sec">КАК ЭТО РАБОТАЕТ</div>
    <div class="sg-card">
      <div class="info-row">
        <SolarIcon name="lock-keyhole-linear" :size="22" color="#0a84ff" />
        <div class="info-text">
          <b>Два устройства с одинаковым ключом:</b>
          <span>Сообщения автоматически расшифровываются и отображаются как обычный текст.</span>
        </div>
      </div>
      <div class="info-row">
        <SolarIcon name="shield-cross-linear" :size="22" color="#f87171" />
        <div class="info-text">
          <b>Устройство без ключа или с другим ключом:</b>
          <span>Вместо текста будет показано «Текст зашифрован». Сервер видит только нечитаемый криптографический шифротекст.</span>
        </div>
      </div>
      <div class="info-row">
        <SolarIcon name="chat-square-check-linear" :size="22" color="#4ade80" />
        <div class="info-text">
          <b>Обычные сообщения:</b>
          <span>Сообщения без шифрования продолжают отображаться как обычно.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  margin-inline: auto;
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

:global(html[data-theme="light"]) .back-circle svg {
  color: #17171b !important;
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

.sg-card {
  background: var(--card);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sg-kv {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.feat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feat-title {
  font-size: var(--text-16);
  font-weight: 600;
  color: var(--text);
}

.feat-desc {
  font-size: var(--text-13);
  color: var(--muted);
  line-height: 1.4;
}

/* Switch Toggle Button */
.switch-btn {
  width: 50px;
  height: 30px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--ui-border);
  padding: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.2s, border-color 0.2s;
  flex-shrink: 0;
}

.switch-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s;
}

:global(html[data-theme="light"]) .switch-thumb {
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.switch-btn.active {
  background: #0a84ff;
  border-color: #0a84ff;
}

.switch-btn.active .switch-thumb {
  transform: translateX(20px);
}

.feat-divider {
  height: 1px;
  background: var(--ui-border);
  margin: var(--space-1) 0;
}

.feat-key-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: var(--text-14);
  color: var(--muted);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.feat-input {
  width: 100%;
  min-height: 48px;
  padding: var(--space-3) 44px var(--space-3) var(--space-4);
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-lg);
  font: inherit;
  font-size: var(--text-15);
  outline: none;
  transition: border-color 0.15s;
}

.feat-input:focus {
  border-color: #0a84ff;
}

.eye-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.feat-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.save-btn {
  min-height: 40px;
  padding: 0 var(--space-4);
  border-radius: 999px;
  background: #0a84ff;
  border: none;
  color: #ffffff;
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, background-color 0.15s;
}

.save-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.save-btn:not(:disabled):hover {
  background: #0070e0;
}

.clear-btn {
  min-height: 40px;
  padding: 0 var(--space-4);
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--ui-border);
  color: var(--text);
  font-size: var(--text-14);
  font-weight: 500;
  cursor: pointer;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.feat-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: var(--text-13);
}

.feat-banner.success {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.25);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--text-13);
  line-height: 1.45;
  color: var(--muted);
}

.info-text b {
  color: var(--text);
}
</style>
