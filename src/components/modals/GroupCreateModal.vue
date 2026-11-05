<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGroupsStore } from '../../stores/groups'
import { useContactsStore } from '../../stores/contacts'
import { useChatStore } from '../../stores/chat'
import { useAuthStore } from '../../stores/auth'
import { useSettingsStore } from '../../stores/settings'
import { FAV_ID, tablesApi } from '../../services/supabase'
import type { UserProfile } from '../../types'
import SolarIcon from '../common/SolarIcon.vue'
import PhotoCropperModal from './PhotoCropperModal.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const groups = useGroupsStore(), contacts = useContactsStore(), chat = useChatStore(), auth = useAuthStore(), settings = useSettingsStore()
const stage = ref<'details' | 'members' | 'result'>('details')
const groupName = ref(''), query = ref(''), error = ref(''), warning = ref('')
const selected = ref(new Map<string, UserProfile>())
const remote = ref<UserProfile[]>([])
const searching = ref(false), creating = ref(false)
const photo = ref<Blob | null>(null), preview = ref(''), cropFile = ref<File | null>(null)
const inputRef = ref<HTMLInputElement | null>(null), fileRef = ref<HTMLInputElement | null>(null), modalRef = ref<HTMLElement | null>(null)
let searchId = 0, timer: ReturnType<typeof setTimeout> | undefined
let priorFocus: HTMLElement | null = null
const localPeople = computed(() => {
  const result = new Map<string, UserProfile>()
  for (const c of contacts.contacts) if (c.profile) result.set(c.profile.id, c.profile)
  for (const c of chat.conversationList) if (c.id !== FAV_ID) result.set(c.id, c.profile)
  return [...result.values()].filter(p => p.id !== auth.user?.id)
})
const people = computed(() => {
  const q = query.value.trim().toLowerCase().replace(/^@/, '')
  const list = new Map<string, UserProfile>()
  for (const p of [...localPeople.value, ...remote.value]) if (p.id !== auth.user?.id && (!q || `${p.name} ${p.username}`.toLowerCase().includes(q))) list.set(p.id, p)
  return [...list.values()]
})
watch(query, value => {
  clearTimeout(timer); const seq = ++searchId; remote.value = []
  const q = value.trim().toLowerCase().replace(/^@/, '')
  if (!q || !auth.user?.id) { searching.value = false; return }
  searching.value = true
  timer = setTimeout(async () => {
    try {
      const result = await tablesApi.profiles.searchByUsername(q, auth.user!.id, 20)
      if (seq !== searchId) return
      if (result.error) throw result.error
      remote.value = (result.data || []) as UserProfile[]
    } catch { if (seq === searchId) error.value = 'Не удалось выполнить поиск. Проверьте подключение.' }
    finally { if (seq === searchId) searching.value = false }
  }, 250)
})
function toggle(user: UserProfile) { if (selected.value.has(user.id)) selected.value.delete(user.id); else selected.value.set(user.id, user) }
function close() { if (!creating.value) emit('close') }
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !cropFile.value) { e.preventDefault(); close() }
  if (e.key !== 'Tab' || !modalRef.value || cropFile.value) return
  const elements = Array.from(modalRef.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'))
  if (!elements.length) return
  const first = elements[0], last = elements[elements.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
onMounted(() => { priorFocus = document.activeElement as HTMLElement; nextTick(() => inputRef.value?.focus()) })
onUnmounted(() => { clearTimeout(timer); if (preview.value) URL.revokeObjectURL(preview.value); priorFocus?.focus() })
function pickFile(e: Event) {
  const input = e.target as HTMLInputElement, file = input.files?.[0]; input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { error.value = 'Выберите JPEG, PNG или WebP размером до 8 МБ.'; return }
  error.value = ''; cropFile.value = file
}
function cropped(blob: Blob) { if (preview.value) URL.revokeObjectURL(preview.value); photo.value = blob; preview.value = URL.createObjectURL(blob); cropFile.value = null }
async function create() {
  if (creating.value || !groupName.value.trim()) return
  error.value = ''; creating.value = true
  try {
    const result = await groups.createGroup(groupName.value.trim(), photo.value || undefined, [...selected.value.keys()])
    if (result.warning) { warning.value = result.warning; stage.value = 'result'; return }
    chat.activeChat = null; settings.setPane('dm'); emit('close')
  } catch { error.value = 'Не удалось создать группу. Проверьте подключение и попробуйте снова.' }
  finally { creating.value = false }
}
</script>
<template>
  <Teleport to="body">
    <div class="create-overlay" @click.self="close" @keydown="onKey">
      <section ref="modalRef" class="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <template v-if="stage === 'details'">
          <header class="create-header"><h2 id="create-title">Новая группа</h2><button type="button" class="create-icon" aria-label="Закрыть" @click="close"><SolarIcon name="close-circle-linear" :size="22" /></button></header>
          <div class="create-details">
            <button type="button" class="create-avatar" aria-label="Выбрать фото группы" @click="fileRef?.click()"><img v-if="preview" :src="preview" alt="" /><SolarIcon v-else name="camera-add-linear" :size="30" /></button>
            <input ref="fileRef" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="pickFile" />
            <label class="create-label">Название группы<input ref="inputRef" v-model="groupName" maxlength="16" placeholder="Введите название" autocomplete="off" /><small>{{ groupName.length }}/16</small></label>
          </div>
          <p v-if="error" class="create-error" role="alert">{{ error }}</p>
          <footer class="create-footer"><button type="button" class="create-secondary" @click="close">Отмена</button><button type="button" class="create-primary" :disabled="!groupName.trim()" @click="stage = 'members'; error = ''">Далее</button></footer>
        </template>
        <template v-else-if="stage === 'members'">
          <header class="create-header"><div><h2 id="create-title">Добавить участников</h2><p class="create-counter">Выбрано: {{ selected.size }}</p></div><button type="button" class="create-icon" aria-label="Закрыть" :disabled="creating" @click="close"><SolarIcon name="close-circle-linear" :size="22" /></button></header>
          <label class="create-search"><SolarIcon name="magnifer-linear" :size="20" /><input v-model="query" aria-label="Поиск участников" placeholder="Поиск по имени или юзернейму" :disabled="creating" /></label>
          <div class="create-list"><p class="create-section">{{ query ? 'Результаты поиска' : 'Контакты и недавние чаты' }}</p><p v-if="searching" class="create-muted" role="status">Поиск…</p><p v-else-if="!people.length" class="create-muted">{{ query ? 'Никого не найдено' : 'Контактов пока нет. Найдите участника по юзернейму.' }}</p>
            <button v-for="person in people" :key="person.id" type="button" class="create-person" :aria-pressed="selected.has(person.id)" :disabled="creating" @click="toggle(person)"><span class="person-avatar"><img v-if="person.avatar_url" :src="person.avatar_url" alt="" /><span v-else>{{ person.name.charAt(0).toUpperCase() }}</span></span><span class="person-text"><strong>{{ person.name }}</strong><small>@{{ person.username }}</small></span><span class="person-check" :class="{ checked: selected.has(person.id) }"><SolarIcon v-if="selected.has(person.id)" name="check-linear" :size="16" /></span></button>
          </div>
          <p v-if="error" class="create-error" role="alert">{{ error }}</p><footer class="create-footer"><button type="button" class="create-secondary" :disabled="creating" @click="stage = 'details'">Назад</button><button type="button" class="create-primary" :disabled="creating" @click="create">{{ creating ? 'Создание…' : 'Создать' }}</button></footer>
        </template>
        <template v-else><header class="create-header"><h2 id="create-title">Группа создана</h2></header><p class="create-error" role="alert">{{ warning }}</p><footer class="create-footer"><button type="button" class="create-primary" @click="close">Понятно</button></footer></template>
      </section>
      <PhotoCropperModal v-if="cropFile" :file="cropFile" @cropped="cropped" @close="cropFile = null" />
    </div>
  </Teleport>
</template>
<style scoped>
.create-overlay { position: fixed; inset: 0; z-index: 10000; display: flex; justify-content: center; align-items: center; padding: var(--space-4); background: rgba(0,0,0,.65); }
.create-dialog { width: min(100%, 400px); max-height: min(640px, calc(100dvh - 32px)); min-height: min(480px, calc(100dvh - 32px)); display: flex; flex-direction: column; padding: var(--space-6); border-radius: 24px; background: var(--card); color: var(--text); box-shadow: 0 24px 70px rgba(0,0,0,.4); }
.create-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-4); }.create-header h2 { margin: 0; font-size: var(--text-20); line-height: 1.3; }.create-counter, .create-muted { margin: var(--space-1) 0 0; color: var(--muted); font-size: var(--text-14); }
.create-icon { width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--surface); color: var(--text); cursor: pointer; }
.create-details { display: flex; flex-direction: column; align-items: center; gap: var(--space-6); flex: 1; }.create-avatar { width: 96px; height: 96px; padding: 0; border-radius: 50%; background: var(--surface); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; }.create-avatar img { width: 100%; height: 100%; object-fit: cover; }
.create-label { width: 100%; display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-14); font-weight: 600; }.create-label input, .create-search input { min-width: 0; width: 100%; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); font: inherit; }.create-label small { align-self: flex-end; color: var(--muted); font-weight: 400; }
.create-search { display: flex; align-items: center; padding-left: var(--space-4); border-radius: var(--radius-lg); color: var(--muted); background: var(--surface); }.create-search input { background: transparent; padding-left: var(--space-2); box-shadow: none; }
.create-list { min-height: 0; flex: 1; overflow-y: auto; margin-top: var(--space-4); }.create-section { color: var(--muted); font-size: var(--text-12); font-weight: 600; margin: 0 0 var(--space-2); }
.create-person { width: 100%; padding: var(--space-2); display: flex; align-items: center; gap: var(--space-3); border-radius: var(--radius-md); background: transparent; color: var(--text); text-align: left; cursor: pointer; }.create-person:hover { background: var(--surface); }.person-avatar { width: 44px; height: 44px; flex: none; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; overflow: hidden; }.person-avatar img { width: 100%; height: 100%; object-fit: cover; }.person-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }.person-text strong, .person-text small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.person-text small { color: var(--muted); }.person-check { width: 24px; height: 24px; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; }.person-check.checked { background: #4a63f0; color: white; }
.create-footer { display: flex; justify-content: flex-end; align-items: center; gap: var(--space-3); margin-top: var(--space-4); }.create-secondary, .create-primary { min-height: 44px; padding: 0 var(--space-5); border-radius: 999px; font: inherit; font-weight: 600; cursor: pointer; }.create-secondary { background: transparent; color: var(--text); }.create-primary { background: var(--text); color: var(--bg); }.create-primary:disabled { opacity: .45; cursor: default; }.create-error { color: var(--danger); font-size: var(--text-14); line-height: 1.5; }
</style>
