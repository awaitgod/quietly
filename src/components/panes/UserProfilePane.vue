<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { useAuthStore } from '../../stores/auth'
import GiftGallery from '../common/GiftGallery.vue'
import { FAV_ID } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'
import EmojiText from '../common/EmojiText.vue'
import GroupManager from '../modals/GroupManager.vue'

const settings = useSettingsStore()
const chat = useChatStore()
const groups = useGroupsStore()
const auth = useAuthStore()
const emit = defineEmits<{ (e: 'send-gift', recipient: { id: string; name: string }): void }>()
const copied = ref(false)
const user = computed(() => settings.viewedUser)
const group = computed(() => !user.value ? groups.activeGroup : null)
const favorite = computed(() => user.value?.id === FAV_ID)
const title = computed(() => user.value?.name || group.value?.name || '')
const avatar = computed(() => user.value?.avatar_url || group.value?.avatar_url)
const bio = computed(() => user.value?.bio || user.value?.description || user.value?.about)
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
        <SolarIcon name="alt-arrow-left-linear" :size="22" />
      </button>
      <div class="profile-hero">
        <div class="profile-avatar" :class="{ 'profile-favorite': favorite, 'profile-group': group && !avatar }">
          <img v-if="avatar" :src="avatar" alt="" />
          <SolarIcon v-else-if="favorite" name="bookmark-bold" :size="72" />
          <SolarIcon v-else-if="group" name="users-group-rounded-bold" :size="72" />
          <span v-else>{{ title.charAt(0).toUpperCase() }}</span>
        </div>
        <h1><EmojiText :text="title" /></h1>
        <p v-if="favorite" class="profile-subtitle">Бот</p>
        <p v-else-if="group" class="profile-subtitle">Участников: {{ groups.groupMembers.length }}</p>
      </div>
      <div class="profile-actions">
        <button type="button" class="write-button" @click="write"><SolarIcon name="chat-round-dots-linear" :size="20" /> Написать</button>
        <button v-if="user && !favorite && user.id !== auth.user?.id" type="button" class="back-button gift-action" aria-label="Подарить подарок" @click="emit('send-gift', { id: user.id, name: title })"><SolarIcon name="gift-linear" :size="22" /></button>
        <GroupManager v-if="group" :group="group" />
      </div>
      <div v-if="favorite || user?.username || bio" class="profile-info-card">
        <div v-if="favorite" class="profile-info-row">
          <div class="profile-label">О себе</div>
          <p>Официальное хранилище данных «Избранное». Сохраняй сюда заметки, ссылки и важные сообщения — их видишь только ты.</p>
        </div>
        <div v-if="!favorite && user?.username" class="profile-username-row">
          <div><div class="profile-label">Юзернейм</div><div class="profile-username">@{{ user.username }}</div></div>
          <button type="button" class="copy-button" aria-label="Скопировать юзернейм" @click="copyUsername"><SolarIcon name="copy-linear" :size="20" /></button>
        </div>
        <p v-if="copied" class="copy-status" role="status">Юзернейм скопирован</p>
        <div v-if="!favorite && bio" class="profile-info-row"><div class="profile-label">О себе</div><p><EmojiText :text="bio" /></p></div>
      </div>
      <GiftGallery v-if="user && !favorite" :user-id="user.id" />
    </div>
  </section>
</template>

<style scoped>
.profile-info { width: 100%; height: 100%; overflow-y: auto; padding: var(--space-8) var(--space-6); color: var(--text); }
.profile-content { position: relative; width: min(100%, 440px); margin-inline: auto; min-width: 0; }
.back-button, .copy-button { border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.back-button { position: absolute; left: 0; top: 0; width: 44px; height: 44px; border-radius: 50%; background: var(--surface); color: var(--text); }
.profile-hero { display: flex; flex-direction: column; align-items: center; text-align: center; }
.profile-avatar { width: 160px; height: 160px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--surface); font-size: 64px; font-weight: 700; }
.profile-avatar.profile-favorite { background: #28a8ea; color: white; }
.profile-avatar.profile-group { background: #5c62d6; color: white; }
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
h1 { margin: var(--space-4) 0 0; color: var(--text); font-size: var(--text-24); line-height: 1.3; text-align: center; overflow-wrap: anywhere; }
.profile-subtitle { margin: var(--space-1) 0 0; color: var(--muted); font-size: var(--text-14); }
.gift-action { position: static; flex: none; }
.profile-actions { display: flex; gap: var(--space-2); align-items: flex-end; }
.write-button { flex: 1; min-width: 0; width: 100%; min-height: 48px; margin-top: var(--space-6); border: 0; border-radius: 999px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); background: var(--text); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
.profile-info-card { width: 100%; margin-top: var(--space-4); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface); }
.profile-info-row { display: block; text-align: left; }
.profile-info-row + .profile-info-row, .profile-username-row + .profile-info-row { margin-top: var(--space-4); }
.profile-label { color: var(--muted); font-size: var(--text-12); font-weight: 600; }
.profile-info-row p { margin: var(--space-1) 0 0; line-height: 1.5; overflow-wrap: anywhere; }
.profile-username-row { width: 100%; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.profile-username-row > div { flex: 1; min-width: 0; }
.profile-username { color: #63aaff; overflow-wrap: anywhere; }
.copy-button { width: 40px; height: 40px; flex: none; border-radius: 50%; background: transparent; color: #63aaff; }
.copy-status { margin: var(--space-1) 0 0; color: var(--muted); font-size: var(--text-12); }
.profile-gifts { margin-top: var(--space-6); }.profile-gifts h2 { font-size: var(--text-16); margin: 0 0 var(--space-3); }.profile-gifts h2 span { color: var(--muted); }
.profile-gift-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(120px,1fr)); gap: var(--space-3); }.profile-gift-card { min-height: 120px; padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--space-2); font-size:32px; }.profile-gift-card small { font-size:var(--text-12); color:var(--muted); text-align:center; }
@media (max-width: 480px) { .profile-info { padding: var(--space-4); }.profile-avatar { width: 128px; height: 128px; } }
@media (max-width: 240px) { .profile-hero { padding-top: 56px; } }
:global(html[data-theme="light"]) .profile-username, :global(html[data-theme="light"]) .copy-button { color: #145bb5; }
</style>
