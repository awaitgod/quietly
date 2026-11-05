<script setup lang="ts">
import GiftGallery from '../common/GiftGallery.vue'
import { computed, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useAudioStore } from '../../stores/audio'
import SolarIcon from '../common/SolarIcon.vue'
import EmojiText from '../common/EmojiText.vue'

const emit = defineEmits<{ (e: 'edit-profile'): void; (e: 'open-accounts'): void; (e: 'open-topup'): void; (e: 'open-promo'): void }>()
const auth = useAuthStore()
const audio = useAudioStore()
const profile = computed(() => auth.profile)
const favTrack = computed(() => audio.tracks.find(t => t.is_favorite))
const copied = ref(false)
async function copyUsername() {
  if (!profile.value?.username) return
  try { await navigator.clipboard.writeText(`@${profile.value.username}`); copied.value = true }
  catch { copied.value = false }
}
</script>

<template>
  <section v-if="profile" class="own-profile" aria-label="Мой профиль">
    <div class="own-content">
      <div class="own-hero">
        <div class="own-avatar"><img v-if="profile.avatar_url" :src="profile.avatar_url" alt="" /><span v-else>{{ profile.name.charAt(0).toUpperCase() }}</span></div>
        <h1><EmojiText :text="profile.name" /></h1>
      </div>
      <button type="button" class="own-account-switch" @click="emit('open-accounts')"><SolarIcon name="users-group-rounded-linear" :size="20" /> Аккаунты <SolarIcon name="alt-arrow-right-linear" :size="18" /></button>
      <button type="button" class="own-primary" @click="emit('edit-profile')">Редактировать профиль</button>
      <div class="own-card">
        <div class="own-row">
          <div class="own-row-content"><div class="own-label">Юзернейм</div><div class="own-username">@{{ profile.username }}</div></div>
          <button type="button" class="own-icon-button" aria-label="Скопировать юзернейм" @click="copyUsername"><SolarIcon name="copy-linear" :size="20" /></button>
        </div>
        <p v-if="copied" class="own-status" role="status">Юзернейм скопирован</p>
        <div v-if="profile.bio" class="own-bio"><div class="own-label">О себе</div><p><EmojiText :text="profile.bio" /></p></div>
      </div>
      <div class="own-card own-balance">
        <div class="own-balance-content"><span class="own-coin"><EmojiText text="🪙" /></span><div><div class="own-label">Баланс</div><strong>{{ profile.qcoin || 0 }} Qcoin</strong></div></div>
        <button type="button" class="own-secondary" @click="emit('open-topup')">Пополнить</button>
      </div>
      <button type="button" class="own-promo" @click="emit('open-promo')">Ввести промокод</button>
      <GiftGallery :user-id="profile.id" />
      <div v-if="favTrack" class="own-card own-track">
        <div class="own-cover"><img v-if="favTrack.cover_url" :src="favTrack.cover_url" alt="" /><SolarIcon v-else name="music-notes-linear" :size="20" /></div>
        <div class="own-track-info"><strong>{{ favTrack.title }}</strong><span>{{ favTrack.artist }}</span></div>
        <button type="button" class="own-icon-button" :aria-label="audio.isPlaying && audio.currentTrack?.id === favTrack.id ? 'Приостановить' : 'Воспроизвести'" @click="audio.playTrack(audio.tracks.indexOf(favTrack))"><SolarIcon :name="audio.isPlaying && audio.currentTrack?.id === favTrack.id ? 'pause-circle-bold' : 'play-circle-bold'" :size="24" /></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.own-profile { width: 100%; height: 100%; overflow-y: auto; padding: var(--space-8) var(--space-6); color: var(--text); }
.own-content { width: min(100%, 440px); min-width: 0; margin-inline: auto; }
.own-hero { display: flex; flex-direction: column; align-items: center; text-align: center; }
.own-avatar { width: 160px; height: 160px; border-radius: 50%; overflow: hidden; background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 700; }
.own-avatar img { width: 100%; height: 100%; object-fit: cover; }
h1 { margin: var(--space-4) 0 0; color: var(--text); font-size: var(--text-24); line-height: 1.3; text-align: center; overflow-wrap: anywhere; }
.own-account-switch { width:100%; margin-top:24px; padding:14px 16px; display:flex; align-items:center; gap:10px; border:0; border-radius:16px; background:var(--surface); color:var(--text); font:inherit; font-weight:600; cursor:pointer; }
.own-account-switch svg:last-child { margin-left:auto; color:var(--muted); }
.own-primary { width: 100%; min-height: 48px; margin-top: var(--space-6); border-radius: 999px; display: flex; align-items: center; justify-content: center; background: var(--text); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
.own-card { margin-top: var(--space-4); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface); }
.own-row, .own-balance, .own-balance-content, .own-track { display: flex; align-items: center; gap: var(--space-3); }
.own-row-content, .own-balance-content, .own-track-info { flex: 1; min-width: 0; }
.own-label { color: var(--muted); font-size: var(--text-12); font-weight: 600; }
.own-username { color: #63aaff; overflow-wrap: anywhere; }
.own-icon-button { width: 40px; height: 40px; flex: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #63aaff; cursor: pointer; }
.own-status { margin: var(--space-1) 0 0; color: var(--muted); font-size: var(--text-12); }
.own-bio { margin-top: var(--space-4); }.own-bio p { margin: var(--space-1) 0 0; line-height: 1.5; overflow-wrap: anywhere; }
.own-coin { font-size: var(--text-24); }.own-balance strong { color: var(--text); }
.own-secondary { padding: var(--space-2) var(--space-4); border-radius: 999px; background: var(--text); color: var(--bg); font: inherit; font-size: var(--text-14); font-weight: 600; cursor: pointer; }
.own-promo { margin-top: var(--space-2); padding: var(--space-2); background: transparent; color: var(--muted); font: inherit; cursor: pointer; }
.own-cover { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #0a84ff; color: #fff; flex: none; }.own-cover img { width: 100%; height: 100%; object-fit: cover; }
.own-track-info { display: flex; flex-direction: column; }.own-track-info strong, .own-track-info span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.own-track-info span { color: var(--muted); font-size: var(--text-12); }
:global(html[data-theme="light"]) .own-username, :global(html[data-theme="light"]) .own-icon-button { color: #145bb5; }
@media (max-width: 480px) { .own-profile { padding: var(--space-4); }.own-avatar { width: 128px; height: 128px; } }
</style>
