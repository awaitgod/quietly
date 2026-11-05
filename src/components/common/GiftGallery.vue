<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEconomyStore } from '../../stores/economy'
import { useAuthStore } from '../../stores/auth'
import type { UserGift } from '../../types'
import GiftArt from './GiftArt.vue'

const props = defineProps<{ userId: string }>()
const economy = useEconomyStore()
const auth = useAuthStore()
const selected = ref<UserGift | null>(null)
const gifts = computed(() => (economy.giftsByOwner[props.userId] || []).filter(g => !g.hidden || props.userId === auth.user?.id))
watch(() => props.userId, id => { selected.value = null; if (id) void economy.loadUserGifts(id) }, { immediate: true })
function giftInfo(gift: UserGift) { return economy.defaultGifts.find(item => item.id === gift.gift) }
function date(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(d) }
</script>
<template>
  <section v-if="gifts.length || economy.giftErrors[userId]" class="gift-gallery" aria-label="Подарки">
    <h2>Подарки <span>{{ gifts.length }}</span></h2>
    <p v-if="economy.giftErrors[userId]" class="gift-error">Не удалось обновить подарки. <button type="button" @click="economy.loadUserGifts(userId)">Повторить</button></p>
    <div class="gift-grid">
      <button v-for="gift in gifts" :key="gift.id" type="button" class="gift-tile" :aria-label="giftInfo(gift)?.title || 'Подарок'" @click="selected = gift">
        <img v-if="gift.sender_profile?.avatar_url" class="gift-sender" :src="gift.sender_profile.avatar_url" alt="" />
        <span class="gift-image"><GiftArt :gift-id="gift.gift" /></span>
        <span v-if="gift.hidden" class="gift-hidden">Скрыт</span>
      </button>
    </div>
    <Teleport to="body">
      <div v-if="selected" class="gift-overlay" @click.self="selected = null" @keydown.esc="selected = null">
        <div class="gift-detail" role="dialog" aria-modal="true" aria-labelledby="gift-detail-title">
          <div class="gift-detail-image"><GiftArt :gift-id="selected.gift" /></div>
          <h2 id="gift-detail-title">{{ giftInfo(selected)?.title || 'Подарок' }}</h2>
          <dl><div><dt>От</dt><dd>{{ selected.sender_profile?.name || 'Пользователь' }}</dd></div><div><dt>Дата</dt><dd>{{ date(selected.created_at) }}</dd></div><div><dt>Стоимость</dt><dd>{{ selected.price }} Qcoin</dd></div><div v-if="selected.message"><dt>Сообщение</dt><dd>{{ selected.message }}</dd></div></dl>
          <button type="button" class="gift-close" @click="selected = null">Закрыть</button>
        </div>
      </div>
    </Teleport>
  </section>
</template>
<style scoped>
.gift-gallery { margin-top: var(--space-5); color: var(--text); }.gift-gallery h2 { font-size: var(--text-14); margin: 0 0 var(--space-3); }.gift-gallery h2 span { color: var(--muted); }.gift-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: var(--space-2); }.gift-tile { position: relative; display: grid; place-items: center; min-width: 0; aspect-ratio: 1; border-radius: var(--radius-lg); background: var(--surface); cursor: pointer; }.gift-tile:hover { filter: brightness(1.08); }.gift-image { display: block; width: 72%; height: 72%; }.gift-sender { position: absolute; top: 8px; left: 8px; width: 24px; height: 24px; object-fit: cover; border-radius: 50%; }.gift-hidden { position: absolute; bottom: 6px; color: var(--muted); font-size: 11px; }.gift-error { color: var(--muted); font-size: var(--text-14); }.gift-error button { color: var(--text); background: none; cursor: pointer; text-decoration: underline; }.gift-overlay { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.55); backdrop-filter: blur(8px); }.gift-detail { width: min(100%, 360px); padding: 24px; border-radius: 24px; background: var(--surface); color: var(--text); }.gift-detail-image { display: grid; place-items: center; width: 144px; height: 144px; margin: 0 auto; }.gift-detail h2 { text-align: center; font-size: var(--text-20); }.gift-detail dl { margin: 16px 0; background: var(--bg); border-radius: 16px; padding: 8px 16px; }.gift-detail dl div { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 8px 0; }.gift-detail dt { color: var(--muted); }.gift-detail dd { margin: 0; overflow-wrap: anywhere; }.gift-close { width: 100%; min-height: 48px; border-radius: 14px; background: var(--text); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
</style>
