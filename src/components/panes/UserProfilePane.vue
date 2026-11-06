<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { usePresenceStore } from '../../stores/presence'
import { useSettingsStore } from '../../stores/settings'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useAuthStore } from '../../stores/auth'
import { useAudioStore } from '../../stores/audio'
import type { AudioTrack } from '../../types'
import { useContactsStore } from '../../stores/contacts'
import GiftGallery from '../common/GiftGallery.vue'
import { FAV_ID } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'
import EmojiText from '../common/EmojiText.vue'
import GroupManager from '../modals/GroupManager.vue'

const presence = usePresenceStore()
const settings = useSettingsStore()
const chat = useChatStore()
const groups = useGroupsStore()
const auth = useAuthStore()
const audio = useAudioStore()
const contacts = useContactsStore()
const blockBusy = ref(false)
const blockError = ref('')
const emit = defineEmits<{ (e: 'send-gift', recipient: { id: string; name: string }): void }>()
const copied = ref(false)
const user = computed(() => settings.viewedUser)
const favoriteTrack = ref<AudioTrack | null>(null)
let trackRequest = 0
watch(() => user.value?.id, async id => {
  const request = ++trackRequest
  favoriteTrack.value = null
  if (!id || id === FAV_ID) return
  const track = await audio.loadUserFavoriteTrack(id)
  if (request === trackRequest) favoriteTrack.value = track
}, { immediate: true })
function playProfileTrack() {
  const track = favoriteTrack.value
  if (!track) return
  if (audio.currentTrack?.audio_url === track.audio_url) { audio.togglePlay(); return }
  let index = audio.tracks.findIndex(item => item.audio_url === track.audio_url)
  if (index < 0) { audio.tracks.push({ ...track, transient: true }); index = audio.tracks.length - 1 }
  audio.playTrack(index)
}
const group = computed(() => !user.value ? groups.activeGroup : null)
watch(() => user.value?.id, (id, oldId) => { if (oldId) presence.unwatchUser(oldId); if (id) presence.watchUser(id) }, { immediate: true })
onUnmounted(() => { if (user.value?.id) presence.unwatchUser(user.value.id) })
const status = computed(() => user.value ? presence.statusFor(user.value.id) : { text: '', online: false })
const favorite = computed(() => user.value?.id === FAV_ID)
const title = computed(() => user.value?.name || group.value?.name || '')
const avatar = computed(() => user.value?.avatar_url || group.value?.avatar_url)
const bio = computed(() => user.value?.bio || user.value?.description || user.value?.about)

function handleAvatarClick() {
  if (avatar.value) {
    settings.openImagePreview(avatar.value, title.value)
  }
}

async function toggleBlocked() {
  if (!user.value || blockBusy.value) return
  blockBusy.value = true
  blockError.value = ''
  try {
    if (contacts.blockedIds.has(user.value.id)) await contacts.unblockUser(user.value.id)
    else await contacts.blockUser(user.value.id)
  } catch { blockError.value = 'Не удалось изменить чёрный список. Попробуйте ещё раз.' }
  finally { blockBusy.value = false }
}
function back() { settings.setPane('dm') }
async function write() {
  if (user.value && chat.activeChat?.id !== user.value.id) {
    groups.activeGroup = null
    await chat.openChat(user.value)
  }
  back()
}
async function copyUsername() {
  if (!user.value?.username) return
  try { await navigator.clipboard.writeText(`@${user.value.username}`); copied.value = true }
  catch { copied.value = false }
}
</script>

<template>
  <section v-if="user || group" class="profile-info" aria-label="Информация о чате">
    <div class="profile-content">
      <button type="button" class="back-button" aria-label="Вернуться к чату" @click="back">
        <SolarIcon name="alt-arrow-left-linear" :size="20" />
      </button>
      <div class="profile-hero">
        <div
          class="profile-avatar"
          :class="{ 'profile-favorite': favorite, 'profile-group': group && !avatar, 'has-photo': !!avatar }"
          role="button"
          tabindex="0"
          :aria-label="avatar ? 'Открыть фотографию профиля' : undefined"
          @click="handleAvatarClick"
          @keydown.enter="handleAvatarClick"
        >
          <img v-if="avatar" :src="avatar" alt="" />
          <SolarIcon v-else-if="favorite" name="bookmark-bold" :size="48" />
          <SolarIcon v-else-if="group" name="users-group-rounded-bold" :size="48" />
          <span v-else>{{ title.charAt(0).toUpperCase() }}</span>
        </div>
        <h1><EmojiText :text="title" /></h1>
        <p v-if="user && status.text" class="profile-subtitle" :class="{ online: status.online }">{{ status.text }}</p>
        <p v-else-if="group" class="profile-subtitle">Участников: {{ groups.groupMembers.length }}</p>
      </div>
      <div class="profile-actions">
        <button type="button" class="write-button" @click="write"><SolarIcon name="chat-round-dots-linear" :size="18" /> Написать</button>
        <button v-if="user && !favorite && user.id !== auth.user?.id" type="button" class="back-button gift-action" aria-label="Подарить подарок" @click="emit('send-gift', { id: user.id, name: title })"><SolarIcon name="gift-linear" :size="20" /></button>
        <GroupManager v-if="group" :group="group" />
      </div>
      <div v-if="favorite || user?.username || bio" class="profile-info-card">
        <div v-if="favorite" class="profile-info-row">
          <div class="profile-label">О себе</div>
          <p>Официальное хранилище данных «Избранное». Сохраняй сюда заметки, ссылки и важные сообщения — их видишь только ты.</p>
        </div>
        <div v-if="!favorite && user?.username" class="profile-username-row">
          <div><div class="profile-label">Юзернейм</div><div class="profile-username">@{{ user.username }}</div></div>
          <button type="button" class="copy-button" aria-label="Скопировать юзернейм" @click="copyUsername"><SolarIcon name="copy-linear" :size="18" /></button>
        </div>
        <p v-if="copied" class="copy-status" role="status">Юзернейм скопирован</p>
        <div v-if="!favorite && bio" class="profile-info-row"><div class="profile-label">О себе</div><p><EmojiText :text="bio" /></p></div>
      </div>
      <button v-if="user && !favorite && user.id !== auth.user?.id" type="button" class="block-user" :disabled="blockBusy" @click="toggleBlocked">{{ contacts.blockedIds.has(user.id) ? 'Разблокировать пользователя' : 'Заблокировать пользователя' }}</button>
      <p v-if="blockError" class="block-error" role="alert">{{ blockError }}</p>
      <div v-if="favoriteTrack" class="profile-track">
        <img v-if="favoriteTrack.cover_url" :src="favoriteTrack.cover_url" alt="" class="profile-track-cover" />
        <span v-else class="profile-track-cover"><SolarIcon name="music-notes-linear" :size="20" /></span>
        <span class="profile-track-info"><strong>{{ favoriteTrack.title }}</strong><small>{{ favoriteTrack.artist }}</small></span>
        <button type="button" class="profile-track-play" :aria-label="audio.isPlaying && audio.currentTrack?.audio_url === favoriteTrack.audio_url ? 'Приостановить' : 'Воспроизвести'" @click="playProfileTrack"><SolarIcon :name="audio.isPlaying && audio.currentTrack?.audio_url === favoriteTrack.audio_url ? 'pause-circle-bold' : 'play-circle-bold'" :size="24" /></button>
      </div>
      <GiftGallery v-if="user && !favorite" :user-id="user.id" />
    </div>
  </section>
</template>

<style scoped>
.profile-track { display: flex; align-items: center; gap: 12px; padding: 14px; margin-top: 14px; border-radius: 16px; background: var(--surface); }
.profile-track-cover { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #0a84ff; color: white; }
.profile-track-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.profile-track-info strong, .profile-track-info small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-track-info small { color: var(--muted); }
.profile-track-play { border: 0; padding: 8px; background: transparent; color: #63aaff; cursor: pointer; }
.block-user { margin-top:14px; padding:8px 0; border:0; background:transparent; color:#e2596a; font:inherit; font-size:var(--text-13); cursor:pointer; }
.block-user:disabled { opacity:.5; cursor:default; }
.block-error { color:#e2596a; font-size:var(--text-13); }
.profile-info { width: 100%; height: 100%; overflow-y: auto; padding: var(--space-6) var(--space-4); color: var(--text); }
.profile-content { position: relative; width: min(100%, 380px); margin-inline: auto; min-width: 0; }
.back-button, .copy-button { border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.back-button { position: absolute; left: 0; top: 0; width: 36px; height: 36px; border-radius: 50%; background: var(--surface); color: var(--text); transition: opacity 0.15s; }
.back-button:hover { opacity: 0.85; }
.profile-hero { display: flex; flex-direction: column; align-items: center; text-align: center; }
.profile-avatar { width: 104px; height: 104px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--surface); font-size: 44px; font-weight: 700; }
.profile-avatar.has-photo { cursor: pointer; }
.profile-avatar.profile-favorite { background: #28a8ea; color: white; }
.profile-avatar.profile-group { background: #5c62d6; color: white; }
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
h1 { margin: 12px 0 0; color: var(--text); font-size: 20px; font-weight: 700; line-height: 1.3; text-align: center; overflow-wrap: anywhere; }
.profile-subtitle.online { color: #3b82f6; }
.profile-subtitle { margin: 3px 0 0; color: var(--muted); font-size: var(--text-13); }
.gift-action { position: static; flex: none; width: 42px; height: auto; min-height: 42px; }
.profile-actions { display: flex; gap: var(--space-2); align-items: stretch; margin-top: 14px; }
.write-button { flex: 1; min-width: 0; width: 100%; min-height: 42px; border: 0; border-radius: 999px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); background: var(--text); color: var(--bg); font: inherit; font-size: var(--text-14); font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
.write-button:hover { opacity: 0.9; }
.profile-info-card { width: 100%; margin-top: 14px; padding: 14px 16px; border-radius: 16px; background: var(--surface); }
.profile-info-row { display: block; text-align: left; }
.profile-info-row + .profile-info-row, .profile-username-row + .profile-info-row { margin-top: 12px; }
.profile-label { color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.profile-info-row p { margin: 4px 0 0; font-size: var(--text-13); line-height: 1.45; overflow-wrap: anywhere; color: var(--text); }
.profile-username-row { width: 100%; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.profile-username-row > div { flex: 1; min-width: 0; }
.profile-username { color: #63aaff; font-size: var(--text-14); overflow-wrap: anywhere; margin-top: 2px; }
.copy-button { width: 34px; height: 34px; flex: none; border-radius: 50%; background: transparent; color: #63aaff; }
.copy-status { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
.profile-gifts { margin-top: var(--space-6); }.profile-gifts h2 { font-size: var(--text-15); margin: 0 0 var(--space-3); }.profile-gifts h2 span { color: var(--muted); }
.profile-gift-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(110px,1fr)); gap: var(--space-3); }.profile-gift-card { min-height: 110px; padding: 12px; border-radius: 14px; background: var(--surface); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--space-2); font-size:28px; }.profile-gift-card small { font-size:11px; color:var(--muted); text-align:center; }
@media (max-width: 480px) { .block-user { margin-top:14px; padding:8px 0; border:0; background:transparent; color:#e2596a; font:inherit; font-size:var(--text-13); cursor:pointer; }
.block-user:disabled { opacity:.5; cursor:default; }
.block-error { color:#e2596a; font-size:var(--text-13); }
.profile-info { padding: var(--space-4); }.profile-avatar { width: 92px; height: 92px; font-size: 38px; } }
@media (max-width: 240px) { .profile-hero { padding-top: 48px; } }
:global(html[data-theme="light"]) .profile-username, :global(html[data-theme="light"]) .copy-button { color: #145bb5; }
</style>
