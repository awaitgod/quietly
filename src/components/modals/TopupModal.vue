<script setup lang="ts">
import { ref } from 'vue'
import { useEconomyStore } from '../../stores/economy'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const economyStore = useEconomyStore()
const isAdding = ref(false)
const errorMessage = ref('')

async function handleAdd() {
  if (isAdding.value) return
  isAdding.value = true
  errorMessage.value = ''
  try {
    await economyStore.addTestCoins()
    emit('close')
  } catch (err: any) {
    errorMessage.value = err.message || 'Не удалось начислить Qcoin'
  } finally {
    isAdding.value = false
  }
}
</script>

<template>
  <div class="app-overlay center show" @click.self="emit('close')">
    <div class="topup-card">
      <div class="topup-head">
        <h2>Пополнение Qcoin</h2>
        <button type="button" class="close-btn" @click="emit('close')">
          <SolarIcon name="close-circle-linear" :size="24" />
        </button>
      </div>

      <div v-if="errorMessage" class="topup-body"><div class="error-text" role="alert">{{ errorMessage }}</div></div>
      <div class="topup-foot">
        <button type="button" class="btn-primary" :disabled="isAdding" @click="handleAdd">
          {{ isAdding ? 'Начисление…' : 'Добавить 1000 Qcoin на аккаунт' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topup-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--surface);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.topup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6) var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.topup-head h2 {
  margin: 0;
  font-family: Unbounded, sans-serif;
  font-size: var(--text-20);
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: var(--space-1);
}

.topup-body {
  padding: var(--space-5) var(--space-6);
}

.tu-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tu-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background-color: var(--card);
  border-radius: 14px;
  border: 1px solid transparent;
  color: #fff;
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s, background-color 0.15s;
}

.tu-row:hover {
  background-color: #2b2b31;
}

.tu-row.active {
  border-color: #4a63f0;
  background-color: rgba(74, 99, 240, 0.1);
}

.tu-row b {
  flex: 1;
  text-align: left;
  font-size: var(--text-16);
}

.tu-price {
  font-weight: 700;
  color: #a9c1ff;
}

.payment-methods {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pm-title {
  font-size: var(--text-14);
  font-weight: 600;
  color: var(--muted);
  margin-bottom: var(--space-1);
}

.pm-radio {
  display: flex;
  align-items: center;
  gap: var(--space-2-5);
  padding: var(--space-2-5) var(--space-3);
  background-color: var(--card);
  border-radius: 12px;
  cursor: pointer;
  font-size: var(--text-14);
}

.topup-foot {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: flex-end;
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

:global(html[data-theme="light"]) .tu-row {
  background-color: #f0f1f5;
  color: #20212a;
}
:global(html[data-theme="light"]) .tu-row:hover {
  background-color: #e5e7ef;
}
:global(html[data-theme="light"]) .tu-row.active {
  background-color: #e8edff;
  border-color: #4a63f0;
}
:global(html[data-theme="light"]) .tu-price { color: #3151b8; }
:global(html[data-theme="light"]) .pm-radio { background-color: #f0f1f5; color: #20212a; }
:global(html[data-theme="light"]) .btn-primary { background-color: #20212a; color: #fff; }
:global(html[data-theme="light"]) .btn-primary:disabled { background-color: #dedfe5; color: #62636c; opacity: 1; }
</style>
