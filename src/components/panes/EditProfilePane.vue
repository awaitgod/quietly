<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { storageApi, tablesApi } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'
import PhotoCropperModal from '../modals/PhotoCropperModal.vue'

const emit = defineEmits<{ (e: 'back'): void }>()
const auth = useAuthStore()
const name = ref(auth.profile?.name || '')
const username = ref(auth.profile?.username || '')
const bio = ref(auth.profile?.bio || '')
const avatar = ref<Blob | null>(null)
const preview = ref('')
const cropFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const saving = ref(false)
const error = ref('')
const normalizedUsername = computed(() => username.value.trim().toLowerCase())
const valid = computed(() => name.value.trim().length >= 2 && name.value.trim().length <= 24 && /^[a-z0-9_]{4,16}$/.test(normalizedUsername.value) && bio.value.length <= 400)
const dirty = computed(() => !!avatar.value || name.value.trim() !== (auth.profile?.name || '') || normalizedUsername.value !== (auth.profile?.username || '') || bio.value !== (auth.profile?.bio || ''))
function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error.value = 'Выберите изображение JPEG, PNG или WebP.'; return }
  if (file.size > 8 * 1024 * 1024) { error.value = 'Размер изображения не должен превышать 8 МБ.'; return }
  error.value = ''
  cropFile.value = file
}
function onCropped(blob: Blob) {
  if (preview.value) URL.revokeObjectURL(preview.value)
  avatar.value = blob
  preview.value = URL.createObjectURL(blob)
  cropFile.value = null
}
onUnmounted(() => { if (preview.value) URL.revokeObjectURL(preview.value) })
async function save() {
  const id = auth.user?.id
  if (!id || !auth.profile || !valid.value || !dirty.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (normalizedUsername.value !== auth.profile.username) {
      const result = await tablesApi.profiles.checkUsername(normalizedUsername.value, id)
      if (result.error) throw result.error
      if (result.data?.length) { error.value = 'Этот юзернейм уже занят.'; return }
    }
    const data: { name: string; username: string; bio: string | null; avatar_url?: string } = { name: name.value.trim(), username: normalizedUsername.value, bio: bio.value.trim() || null }
    if (avatar.value) {
      const upload = await storageApi.avatars.uploadUserAvatar(id, avatar.value)
      if (upload.error) throw upload.error
      data.avatar_url = storageApi.avatars.getPublicUrl(upload.data.path)
    }
    if (auth.user?.id !== id) throw new Error('Сессия изменилась. Войдите в аккаунт снова.')
    const result = await tablesApi.profiles.updateProfile(id, data).select().single()
    if (result.error) throw result.error
    if (auth.user?.id === id) { auth.profile = result.data; emit('back') }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    error.value = e.code === '23505' ? 'Этот юзернейм уже занят.' : (e.message || 'Не удалось сохранить профиль. Проверьте подключение и повторите попытку.')
  } finally { saving.value = false }
}
</script>

<template>
  <section class="edit-profile" aria-label="Редактирование профиля">
    <div class="edit-content">
      <header class="edit-header"><button type="button" class="edit-back" aria-label="Назад к профилю" :disabled="saving" @click="emit('back')"><SolarIcon name="alt-arrow-left-linear" :size="22" /></button><h1>Редактирование профиля</h1></header>
      <form @submit.prevent="save">
        <div class="edit-avatar-wrap"><button type="button" class="edit-avatar" aria-label="Изменить фото профиля" :disabled="saving" @click="fileInput?.click()"><img v-if="preview || auth.profile?.avatar_url" :src="preview || auth.profile?.avatar_url || ''" alt="" /><span v-else>{{ name.charAt(0).toUpperCase() }}</span><span class="edit-camera"><SolarIcon name="camera-linear" :size="18" /></span></button><input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="selectFile" /><span class="edit-hint">Изменить фото</span></div>
        <label class="edit-field"><span>Имя</span><input v-model="name" maxlength="24" autocomplete="name" :disabled="saving" /><small class="edit-count">{{ name.length }}/24</small></label>
        <label class="edit-field"><span>Юзернейм</span><input v-model="username" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" :disabled="saving" /><small class="edit-help"><span>Латинские буквы, цифры и _, от 4 до 16 символов</span><span>{{ username.length }}/16</span></small></label>
        <label class="edit-field"><span>О себе</span><textarea v-model="bio" maxlength="400" rows="4" :disabled="saving"></textarea><small class="edit-count">{{ bio.length }}/400</small></label>
        <p v-if="error" class="edit-error" role="alert">{{ error }}</p>
        <button class="edit-save" type="submit" :disabled="!valid || !dirty || saving">{{ saving ? 'Сохранение…' : 'Сохранить' }}</button>
      </form>
    </div>
    <PhotoCropperModal v-if="cropFile" :file="cropFile" @cropped="onCropped" @close="cropFile = null" />
  </section>
</template>
<style scoped>
.edit-profile { width: 100%; height: 100%; overflow-y: auto; padding: var(--space-8) var(--space-6); color: var(--text); }
.edit-content { width: min(100%, 440px); margin-inline: auto; }
.edit-header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
.edit-header h1 { margin: 0; color: var(--text); font-size: var(--page-title-size); line-height: var(--page-title-line-height); }
.edit-back { width: 44px; height: 44px; flex: none; border-radius: 50%; background: var(--surface); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.edit-avatar-wrap { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); margin-bottom: var(--space-6); }
.edit-avatar { position: relative; width: 128px; height: 128px; padding: 0; border-radius: 50%; background: var(--surface); color: #fff; font-size: 36px; font-weight: 700; cursor: pointer; }
.edit-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.edit-camera { position: absolute; right: 0; bottom: 0; width: 32px; height: 32px; border-radius: 50%; background: #1687e8; color: #fff; display: flex; align-items: center; justify-content: center; }
.edit-hint, .edit-field small { font-size: var(--text-12); color: var(--muted); }
.edit-field { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); font-size: var(--text-14); font-weight: 600; }
.edit-field input, .edit-field textarea { width: 100%; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); font: inherit; font-size: var(--text-16); line-height: 1.5; font-weight: 400; resize: vertical; }
.edit-field input { min-height: 48px; }
.edit-field textarea { min-height: 112px; }
.edit-field small { font-weight: 400; line-height: 1.4; }
.edit-count { align-self: flex-end; font-variant-numeric: tabular-nums; }
.edit-help { display: flex; justify-content: space-between; gap: var(--space-3); }
.edit-help span:last-child { flex: none; font-variant-numeric: tabular-nums; }
.edit-error { color: var(--danger); font-size: var(--text-14); }
.edit-save { width: 100%; min-height: 48px; border-radius: 999px; background: var(--text); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
.edit-save:disabled { opacity: .45; cursor: default; }
@media (max-width: 480px) { .edit-profile { padding: var(--space-4); } }
</style>
