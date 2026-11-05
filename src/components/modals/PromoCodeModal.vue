<script setup lang="ts">
import { ref } from 'vue'
import { useEconomyStore } from '../../stores/economy'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const economyStore = useEconomyStore()
const code = ref('')
const isActivating = ref(false)
const errorMessage = ref('')

async function handleRedeem() {
  const trimmed = code.value.trim().toUpperCase()
  if (!trimmed || isActivating.value) return

  isActivating.value = true
  errorMessage.value = ''

  const res = await economyStore.redeemPromo(trimmed)
  isActivating.value = false

  if (res.ok) {
    emit('close')
  } else {
    errorMessage.value = res.error || 'Не удалось активировать промокод'
  }
}
</script>

<template>
  <div class="app-overlay center show" @click.self="emit('close')">
    <div class="promo-card">
      <div class="promo-head">
        <h2>Активация промокода</h2>
        <button type="button" class="close-btn" @click="emit('close')">
          <SolarIcon name="close-circle-linear" :size="24" />
        </button>
      </div>

      <div class="promo-body">
        <div class="field" :class="{ 'has-error': !!errorMessage }">
          <input
            v-model="code"
            type="text"
            placeholder="ВВЕДИТЕ ПРОМОКОД"
            autocomplete="off"
            spellcheck="false"
            @input="code = code.toUpperCase().replace(/[^A-Z0-9_-]/g, '')"
            @keydown.enter="handleRedeem"
          />
          <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>
        </div>

        <div class="promo-hint">
          Промокоды публикуются в официальном канале и боте
          <a href="https://t.me/QuietlyCoins_robot" target="_blank" rel="noopener">
            @QuietlyCoins_robot
          </a>
        </div>
      </div>

      <div class="promo-foot">
        <button
          type="button"
          class="btn-primary"
          :disabled="!code.trim() || isActivating"
          @click="handleRedeem"
        >
          {{ isActivating ? 'Проверка...' : 'Активировать' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.promo-card {
  width: 100%;
  max-width: 400px;
  background-color: var(--surface);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.promo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6) var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.promo-head h2 {
  margin: 0;
  font-family: Unbounded, sans-serif;
  font-size: var(--text-16);
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: var(--space-1);
}

.promo-body {
  padding: var(--space-5) var(--space-6);
}

.promo-hint {
  font-size: var(--text-12);
  color: var(--muted);
  line-height: 1.5;
  margin-top: var(--space-2-5);
}

.promo-hint a {
  color: #6db3ff;
  text-decoration: none;
}

.promo-foot {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn-primary {
  width: 100%;
  padding: var(--space-3);
  border-radius: 999px;
  border: none;
  background-color: #fff;
  color: #111;
  font-family: Unbounded, sans-serif;
  font-size: var(--text-14);
  font-weight: 700;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
