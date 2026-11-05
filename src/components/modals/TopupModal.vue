<script setup lang="ts">
import EmojiText from '../common/EmojiText.vue'

import { ref } from 'vue'
import { useEconomyStore } from '../../stores/economy'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const economyStore = useEconomyStore()
const selectedPackage = ref<number | null>(null)
const paymentMethod = ref<'sbp' | 'crypto'>('sbp')
const isCreatingPayment = ref(false)
const errorMessage = ref('')

async function handlePay() {
  if (!selectedPackage.value) return
  isCreatingPayment.value = true
  errorMessage.value = ''

  try {
    const url = await economyStore.createTopupPayment(selectedPackage.value, paymentMethod.value)
    if (url) {
      window.open(url, '_blank')
      emit('close')
    } else {
      errorMessage.value = 'Оплата пока недоступна. Попробуйте позже.'
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Ошибка создания платежа'
  } finally {
    isCreatingPayment.value = false
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

      <div class="topup-body">
        <div class="tu-list">
          <button
            v-for="pkg in economyStore.topupPackages"
            :key="pkg.qcoins"
            type="button"
            class="tu-row"
            :class="{ active: selectedPackage === pkg.qcoins }"
            @click="selectedPackage = pkg.qcoins"
          >
            <span class="tu-coin"><EmojiText text="🪙" /></span>
            <b>{{ pkg.qcoins.toLocaleString('ru-RU') }} Qcoin</b>
            <span class="tu-price">{{ pkg.priceRub.toLocaleString('ru-RU') }} ₽</span>
          </button>
        </div>

        <div v-if="selectedPackage" class="payment-methods">
          <div class="pm-title">Способ оплаты:</div>
          <label class="pm-radio">
            <input v-model="paymentMethod" type="radio" value="sbp" />
            <span><b>СБП</b> (QR-код или ссылка в банк)</span>
          </label>
          <label class="pm-radio">
            <input v-model="paymentMethod" type="radio" value="crypto" />
            <span><b>Криптовалюта</b> (USDT / TON / BTC)</span>
          </label>
        </div>

        <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>
      </div>

      <div class="topup-foot">
        <button
          type="button"
          class="btn-primary"
          :disabled="!selectedPackage || isCreatingPayment"
          @click="handlePay"
        >
          {{ isCreatingPayment ? 'Создание платежа...' : 'Оплатить' }}
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
</style>
