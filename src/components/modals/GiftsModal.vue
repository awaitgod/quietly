<script setup lang="ts">
import GiftArt from '../common/GiftArt.vue'

import { ref, onMounted, computed } from 'vue'
import { useEconomyStore } from '../../stores/economy'
import { useAuthStore } from '../../stores/auth'
import SolarIcon from '../common/SolarIcon.vue'

const props = defineProps<{
  recipientId?: string
  recipientName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'gift-sent', giftId: string): void
}>()

const economyStore = useEconomyStore()
const authStore = useAuthStore()

interface GiftCatalogItem {
  id: string
  name: string
  price: number
  limit?: number
  sold?: number
  total?: number
}

const gifts = computed<GiftCatalogItem[]>(() => economyStore.defaultGifts.map(g => {
  const stock = economyStore.giftStocks.find(item => item.gift_id === g.id)
  return { id: g.id, name: g.title, price: g.price, sold: stock?.sold, total: stock?.total ?? g.limit }
}))

const isSending = ref(false)
const selectedGift = ref<GiftCatalogItem | null>(null)
const errorText = ref('')

onMounted(() => { void economyStore.loadGiftStock() })

function handleSelectGift(gift: GiftCatalogItem) {
  if (gift.total != null && gift.sold != null && gift.sold >= gift.total) return
  selectedGift.value = gift
  errorText.value = ''
}
async function sendSelectedGift() {
  const gift = selectedGift.value
  if (!gift || isSending.value) return
  if (!props.recipientId) { errorText.value = 'Не удалось определить получателя'; return }
  const userBalance = authStore.profile?.qcoin || 0
  if (userBalance < gift.price) { errorText.value = `Недостаточно Qcoin (баланс: ${userBalance})`; return }
  isSending.value = true
  errorText.value = ''
  try {
    await economyStore.sendGift(props.recipientId, gift.id)
    emit('gift-sent', gift.id)
    emit('close')
  } catch (err: any) { errorText.value = err.message || 'Ошибка отправки подарка' }
  finally { isSending.value = false }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="gifts-modal-card">
      <!-- Modal Header -->
      <div class="gm-head">
        <h2 class="gm-title">Выберите подарок</h2>
        <button
          type="button"
          class="gm-close-btn"
          aria-label="Закрыть"
          @click="emit('close')"
        >
          <SolarIcon name="close-circle-linear" :size="22" color="#8e8e96" />
        </button>
      </div>

      <p class="gm-recipient">{{ recipientId === authStore.user?.id ? 'Покупка для себя' : `Получатель: ${recipientName || 'пользователь'}` }}</p>
      <!-- Error Text -->
      <div v-if="errorText" class="gm-error">{{ errorText }}</div>

      <!-- 2-Column Grid matching Screenshot 4 -->
      <div class="gm-grid">
        <button
          type="button"
          v-for="item in gifts"
          :key="item.id"
          class="gm-gift-card"
          :class="{
            sold: item.total && item.sold && item.sold >= item.total,
            active: selectedGift?.id === item.id
          }"
          :aria-pressed="selectedGift?.id === item.id"
          @click="handleSelectGift(item)"
        >
          <!-- Sold out badge -->
          <div
            v-if="item.total && item.sold && item.sold >= item.total"
            class="gm-sold-ribbon"
          >
            распродан
          </div>

          <!-- Graphic -->
          <div class="gm-gift-graphic">
            <GiftArt :gift-id="item.id" />
          </div>

          <span class="gm-gift-name">{{ item.name }}</span>
          <span v-if="item.total != null" class="gm-stock">{{ item.sold != null ? `${Math.max(0, item.total - item.sold)} из ${item.total}` : `Тираж ${item.total}` }}</span>

          <!-- Price Pill -->
          <div class="gm-price-pill">
            <span class="gm-currency">$</span>
            <span class="gm-amount">{{ item.price }}</span>
          </div>
        </button>
      </div>
      <button type="button" class="gm-send" :disabled="!selectedGift || isSending" @click="sendSelectedGift">{{ isSending ? 'Отправка…' : recipientId === authStore.user?.id ? 'Купить' : 'Подарить' }}</button>
    </div>
  </div>
</template>

<style scoped>
:global(html[data-theme="light"]) .gm-close-btn { background: #e8e8ed; }


.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.gm-recipient { margin: 0 0 16px; color: var(--muted); font-size: var(--text-14); }
.gm-send { margin-top: 16px; min-height: 48px; border-radius: 14px; background: var(--text); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
.gm-send:disabled { opacity: .45; cursor: default; }
.gm-gift-card.active { outline: 2px solid var(--text); outline-offset: -2px; }
.gifts-modal-card {
  width: 100%;
  max-width: 380px;
  max-height: min(90vh, 760px);
  overflow-y: auto;
  background-color: var(--surface);
  border: 1px solid #232328;
  border-radius: 28px;
  padding: var(--space-6);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
}

.gm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.gm-title {
  font-family: Unbounded, sans-serif;
  font-size: var(--text-20);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.gm-close-btn {
  background: #1b1b20;
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s;
}

.gm-close-btn:hover {
  opacity: 0.8;
}

.gm-error {
  color: #f87171;
  font-size: var(--text-14);
  margin-bottom: var(--space-3);
  text-align: center;
}

.gm-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.gm-gift-card {
  position: relative;
  background-color: var(--bg);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 22px 14px var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  overflow: hidden;
}

.gm-gift-card:hover {
  transform: translateY(-2px);
  background-color: #1f1f26;
  border-color: rgba(255, 255, 255, 0.12);
}

:global(html[data-theme="light"]) .gm-gift-card:hover {
  background-color: #e5e5ec;
  border-color: #d2d2dc;
}

.gm-gift-card:active {
  transform: scale(0.96);
}

.gm-gift-card.sold {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.gm-sold-ribbon {
  position: absolute;
  top: 10px;
  right: -24px;
  transform: rotate(45deg);
  background: #e8486a;
  color: #fff;
  font-size: var(--text-12);
  font-weight: 700;
  padding: var(--space-0-5) var(--space-6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.gm-gift-graphic {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.gm-gift-name { margin-bottom: var(--space-1); color: var(--text); font-weight: 600; font-size: var(--text-14); }
.gm-stock { margin-bottom: var(--space-1); color: var(--muted); font-size: var(--text-12); }
.gm-emoji {
  font-size: 46px;
  line-height: 1;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
}

.gm-price-pill {
  background-color: #0b0b0e;
  border-radius: 999px;
  padding: var(--space-1) 14px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: Montserrat, sans-serif;
  font-size: var(--text-14);
  font-weight: 700;
  color: #ffffff;
}

.gm-currency {
  color: #a0a0aa;
}
</style>
