<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useChatStore } from '../../stores/chat'
import { useContactsStore } from '../../stores/contacts'
import { useGroupsStore } from '../../stores/groups'
import { useSettingsStore } from '../../stores/settings'
import { rpcApi, storageApi, tablesApi, FAV_ID } from '../../services/supabase'
import type { Group, UserProfile } from '../../types'
import SolarIcon from '../common/SolarIcon.vue'
import PhotoCropperModal from './PhotoCropperModal.vue'

const props = defineProps<{ group: Group }>()
const auth = useAuthStore(), chat = useChatStore(), contacts = useContactsStore(), groups = useGroupsStore(), settings = useSettingsStore()
const menu = ref(false), view = ref<'' | 'settings' | 'members' | 'add' | 'clear' | 'delete'>('')
const busy = ref(false), error = ref(''), query = ref(''), searchResults = ref<UserProfile[]>([]), selected = ref(new Map<string, UserProfile>())
const name = ref(''), publicGroup = ref(false), history = ref(true), noForward = ref(false), reactions = ref<'all' | 'none' | 'custom'>('all')
let initialReactions: 'all' | 'none' | 'custom' = 'all'
const username = ref(''), photo = ref<Blob | null>(null), preview = ref(''), cropFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null), dialog = ref<HTMLElement | null>(null), menuButton = ref<HTMLButtonElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined, request = 0
const role = computed(() => props.group.owner_id === auth.user?.id ? 'owner' : groups.groupMembers.find(m => m.user_id === auth.user?.id)?.role)
const canManage = computed(() => role.value === 'owner' || role.value === 'admin')
const members = computed(() => groups.groupMembers.map(m => ({ ...m, person: groups.groupProfiles.get(m.user_id) })))
const candidates = computed(() => {
  const map = new Map<string, UserProfile>(); const q = query.value.trim().replace(/^@/, '').toLowerCase()
  for (const c of contacts.contacts) if (c.profile) map.set(c.profile.id, c.profile)
  for (const c of chat.conversationList) if (c.id !== FAV_ID) map.set(c.id, c.profile)
  for (const p of searchResults.value) map.set(p.id, p)
  return [...map.values()].filter(p => !groups.groupMembers.some(m => m.user_id === p.id) && p.id !== auth.user?.id && (!q || `${p.name} ${p.username}`.toLowerCase().includes(q)))
})
watch(query, value => {
  clearTimeout(timer); const seq = ++request; searchResults.value = []
  const q = value.trim().replace(/^@/, '').toLowerCase(); if (!q || !auth.user?.id) return
  timer = setTimeout(async () => { try { const r = await tablesApi.profiles.searchByUsername(q, auth.user!.id, 20); if (r.error) throw r.error; if (seq === request) searchResults.value = (r.data || []) as UserProfile[] } catch { if (seq === request) error.value = 'Не удалось выполнить поиск.' } }, 250)
})
function open(v: typeof view.value) {
  menu.value = false; error.value = ''; view.value = v; selected.value.clear(); query.value = ''
  if (v === 'settings') { name.value = props.group.name; username.value = props.group.username || ''; publicGroup.value = !!props.group.is_public; history.value = props.group.history_visible !== false; noForward.value = !!props.group.no_forward; reactions.value = props.group.allowed_reactions === null || props.group.allowed_reactions === undefined ? 'all' : props.group.allowed_reactions.length === 0 ? 'none' : 'custom'; initialReactions = reactions.value }
  nextTick(() => dialog.value?.focus())
}
function close() { if (busy.value) return; view.value = ''; error.value = ''; if (preview.value) URL.revokeObjectURL(preview.value); preview.value = ''; photo.value = null; nextTick(() => menuButton.value?.focus()) }
onUnmounted(() => { clearTimeout(timer); if (preview.value) URL.revokeObjectURL(preview.value) })
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !cropFile.value) { e.preventDefault(); close(); return }
  if (e.key !== 'Tab' || !dialog.value || cropFile.value) return
  const els = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')).filter(el => el.offsetParent !== null)
  if (!els.length) return
  if (e.shiftKey && (document.activeElement === els[0] || document.activeElement === dialog.value)) { e.preventDefault(); els[els.length - 1].focus() }
  else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus() }
}
function selectFile(e: Event) { const input = e.target as HTMLInputElement, file = input.files?.[0]; input.value = ''; if (!file) return; if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { error.value = 'Выберите JPEG, PNG или WebP размером до 8 МБ.'; return }; cropFile.value = file }
function cropped(blob: Blob) { if (preview.value) URL.revokeObjectURL(preview.value); photo.value = blob; preview.value = URL.createObjectURL(blob); cropFile.value = null }
function apply(group: Group) { if (groups.activeGroup?.id === group.id) groups.activeGroup = group; const index = groups.groups.findIndex(g => g.id === group.id); if (index >= 0) groups.groups[index] = group }
async function save() {
  if (!canManage.value || !auth.user?.id || !name.value.trim() || busy.value) return
  if (publicGroup.value && !/^[a-z0-9_]{4,32}$/.test(username.value.trim().toLowerCase())) { error.value = 'Для публичной группы укажите юзернейм: 4–32 латинские буквы, цифры или _.'; return }
  busy.value = true; error.value = ''
  try {
    const id = props.group.id; let avatarUrl = props.group.avatar_url
    if (photo.value) { const up = await storageApi.avatars.uploadGroupAvatar(auth.user.id, photo.value); if (up.error) throw up.error; avatarUrl = storageApi.avatars.getPublicUrl(up.data.path) }
    const meta = await tablesApi.groups.updateMeta(id, { name: name.value.trim(), avatar_url: avatarUrl }); if (meta.error || !meta.data) throw meta.error || new Error(); apply(meta.data as Group)
    const options = await tablesApi.groups.updateSettings(id, { is_public: publicGroup.value, no_forward: noForward.value, username: username.value.trim().toLowerCase() || undefined }); if (options.error || !options.data) throw options.error || new Error(); apply(options.data as Group)
    const hist = await tablesApi.groups.updateHistoryVisible(id, history.value); if (hist.error || !hist.data) throw hist.error || new Error(); apply(hist.data as Group)
    if (reactions.value !== initialReactions && reactions.value !== 'custom') { const react = await tablesApi.groups.updateAllowedReactions(id, reactions.value === 'all' ? null : []); if (react.error || !react.data) throw react.error || new Error(); apply(react.data as Group) }
    busy.value = false; close()
  } catch { error.value = 'Не удалось сохранить все настройки. Успешно сохранённые изменения уже применены; проверьте данные и попробуйте снова.' }
  finally { busy.value = false }
}
async function refreshMembers() { const res = await tablesApi.groupMembers.getGroupMembers(props.group.id); if (res.error) throw res.error; const rows = res.data || []; const prof = await tablesApi.profiles.getByIds(rows.map(m => m.user_id)); if (prof.error) throw prof.error; groups.groupMembers = rows as typeof groups.groupMembers; groups.groupProfiles = new Map((prof.data || []).map(p => [p.id, p as UserProfile])) }
async function add() { if (!selected.value.size || busy.value) return; busy.value = true; error.value = ''; try { const r = await tablesApi.groupMembers.insertMembers([...selected.value.keys()].map(user_id => ({ group_id: props.group.id, user_id, role: 'member' as const }))); if (r.error) throw r.error; await refreshMembers(); busy.value = false; close() } catch { error.value = 'Не удалось добавить участников. Обновите список и проверьте права доступа.' } finally { busy.value = false } }
async function confirmAction() { if (busy.value) return; busy.value = true; error.value = ''; try { if (view.value === 'clear') { await rpcApi.clearGroupHistory(props.group.id); groups.groupMessages = []; groups.pinnedGroupMessages = []; busy.value = false; close() } else if (view.value === 'delete') { const r = await tablesApi.groups.deleteGroup(props.group.id).select('id'); if (r.error || !r.data?.length) throw r.error || new Error(); groups.groups = groups.groups.filter(g => g.id !== props.group.id); groups.activeGroup = null; settings.setPane('dm'); view.value = '' } } catch { error.value = 'Не удалось выполнить действие. Проверьте права и подключение.' } finally { busy.value = false } }
</script>
<template>
  <div class="gm-anchor">
    <button ref="menuButton" type="button" class="gm-more" aria-label="Действия с группой" :aria-expanded="menu" @click="menu = !menu"><SolarIcon name="menu-dots-bold" :size="20" /></button>
    <template v-if="menu"><div class="gm-dismiss" @click="menu = false"></div><div class="gm-menu" @keydown.esc.stop="menu = false; menuButton?.focus()"><button v-if="canManage" type="button" @click="open('add')">Добавить участников</button><button v-if="canManage" type="button" @click="open('settings')">Управление группой</button><button type="button" @click="open('members')">Участники</button><button v-if="canManage" type="button" class="danger" @click="open('clear')">Очистить историю</button><button v-if="role === 'owner'" type="button" class="danger" @click="open('delete')">Удалить группу</button></div></template>
    <Teleport to="body"><div v-if="view" class="gm-overlay" @click.self="close" @keydown="onKey"><section ref="dialog" class="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-title" tabindex="-1">
      <header class="gm-head"><h2 id="gm-title">{{ view === 'settings' ? 'Настройки группы' : view === 'add' ? 'Добавить участников' : view === 'members' ? 'Участники' : view === 'clear' ? 'Очистить историю?' : 'Удалить группу?' }}</h2><button type="button" class="gm-close" aria-label="Закрыть" :disabled="busy" @click="close"><SolarIcon name="close-circle-linear" :size="22" /></button></header>
      <div v-if="view === 'settings'" class="gm-body">
        <div class="gm-meta"><button type="button" class="gm-avatar" aria-label="Изменить фото группы" @click="fileInput?.click()"><img v-if="preview || group.avatar_url" :src="preview || group.avatar_url || ''" alt="" /><SolarIcon v-else name="camera-add-linear" :size="25" /></button><input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="selectFile" /><label>Название<input v-model="name" maxlength="16" /></label></div>
        <label class="gm-row"><span>Тип группы</span><select v-model="publicGroup"><option :value="false">Частная</option><option :value="true">Публичная</option></select></label>
        <label v-if="publicGroup" class="gm-label">Юзернейм группы<input v-model="username" maxlength="32" placeholder="group_name" /></label>
        <label class="gm-row"><span>История для новых участников</span><select v-model="history"><option :value="true">Видна</option><option :value="false">Скрыта</option></select></label>
        <label class="gm-row"><span>Реакции</span><select v-model="reactions"><option value="all">Все</option><option value="none">Выключены</option><option v-if="initialReactions === 'custom'" value="custom">Выбранные</option></select></label>
        <label class="gm-row"><span>Пересылка и копирование</span><select v-model="noForward"><option :value="false">Разрешены</option><option :value="true">Запрещены</option></select></label>
        <button type="button" class="gm-link" @click="open('members')">Участники <span>{{ members.length }}</span></button>
      </div>
      <div v-else-if="view === 'add'" class="gm-body"><label class="gm-label">Поиск участников<input v-model="query" placeholder="Имя или юзернейм" /></label><p class="gm-muted">Выбрано: {{ selected.size }}</p><button v-for="p in candidates" :key="p.id" type="button" class="gm-person" :aria-pressed="selected.has(p.id)" @click="selected.has(p.id) ? selected.delete(p.id) : selected.set(p.id, p)"><span>{{ p.name }}<small>@{{ p.username }}</small></span><SolarIcon v-if="selected.has(p.id)" name="check-circle-bold" :size="20" /></button><p v-if="!candidates.length" class="gm-muted">Нет доступных участников.</p></div>
      <div v-else-if="view === 'members'" class="gm-body"><div v-for="m in members" :key="m.user_id" class="gm-person"><span>{{ m.person?.name || 'Участник' }}<small>{{ m.person?.username ? '@' + m.person.username : '' }}</small></span><span class="gm-muted">{{ m.role === 'owner' ? 'Владелец' : m.role === 'admin' ? 'Администратор' : 'Участник' }}</span></div><p v-if="!members.length" class="gm-muted">Список участников недоступен.</p></div>
      <p v-else class="gm-muted">{{ view === 'clear' ? 'История сообщений группы будет очищена для всех участников.' : 'Группа и её содержимое будут удалены.' }}</p>
      <p v-if="error" class="gm-error" role="alert">{{ error }}</p>
      <footer class="gm-footer"><button type="button" class="gm-secondary" :disabled="busy" @click="close">Отмена</button><button v-if="view === 'settings'" type="button" class="gm-primary" :disabled="busy || !name.trim()" @click="save">{{ busy ? 'Сохранение…' : 'Сохранить' }}</button><button v-else-if="view === 'add'" type="button" class="gm-primary" :disabled="busy || !selected.size" @click="add">{{ busy ? 'Добавление…' : 'Добавить' }}</button><button v-else-if="view === 'clear' || view === 'delete'" type="button" class="gm-danger-button" :disabled="busy" @click="confirmAction">{{ busy ? 'Выполняется…' : view === 'clear' ? 'Очистить' : 'Удалить' }}</button></footer>
    </section><PhotoCropperModal v-if="cropFile" :file="cropFile" @cropped="cropped" @close="cropFile = null" /></div></Teleport>
  </div>
</template>
<style scoped>
.gm-anchor { position: relative; flex: none; }.gm-more,.gm-close { width: 48px; height: 48px; padding: 0; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--surface); color:var(--text); cursor:pointer; }.gm-dismiss { position:fixed; inset:0; z-index:100; }.gm-menu { position:absolute; z-index:101; top:calc(100% + 8px); right:0; width:240px; padding:var(--space-2); border-radius:var(--radius-lg); background:var(--surface); box-shadow:0 12px 32px rgba(0,0,0,.25); }.gm-menu button { width:100%; min-height:44px; padding:var(--space-2) var(--space-3); text-align:left; background:transparent; color:var(--text); border-radius:var(--radius-md); font:inherit; cursor:pointer; }.gm-menu button:hover { background:var(--card); }.gm-menu .danger,.gm-error { color:var(--danger); }
.gm-overlay { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:var(--space-4); background:rgba(0,0,0,.65); }.gm-dialog { width:min(100%,440px); max-height:calc(100dvh - 32px); display:flex; flex-direction:column; padding:var(--space-6); border-radius:24px; background:var(--card); color:var(--text); box-shadow:0 24px 70px rgba(0,0,0,.4); }.gm-head { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); margin-bottom:var(--space-4); }.gm-head h2 { margin:0; font-size:var(--text-20); line-height:1.3; }.gm-close { width:40px; height:40px; flex:none; }.gm-body { min-height:0; overflow-y:auto; }.gm-meta { display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4); }.gm-meta label,.gm-label { flex:1; min-width:0; display:flex; flex-direction:column; gap:var(--space-2); font-size:var(--text-14); }.gm-meta input,.gm-label input { min-height:44px; width:100%; padding:var(--space-3); background:var(--surface); color:var(--text); border-radius:var(--radius-md); font:inherit; }.gm-avatar { width:56px; height:56px; padding:0; flex:none; border-radius:50%; background:var(--surface); color:var(--text); overflow:hidden; cursor:pointer; }.gm-avatar img { width:100%; height:100%; object-fit:cover; }.gm-row,.gm-person,.gm-link { width:100%; min-height:52px; display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-2) var(--space-3); border-radius:var(--radius-md); color:var(--text); background:transparent; text-align:left; font:inherit; }.gm-row select { max-width:48%; padding:var(--space-2); color:var(--text); background:var(--surface); border-radius:var(--radius-md); font:inherit; }.gm-person,.gm-link { cursor:pointer; }.gm-person:hover,.gm-link:hover { background:var(--surface); }.gm-person span:first-child { display:flex; flex-direction:column; min-width:0; }.gm-person small,.gm-muted,.gm-link span { color:var(--muted); font-size:var(--text-12); }.gm-error { font-size:var(--text-14); }.gm-footer { display:flex; justify-content:flex-end; gap:var(--space-2); margin-top:var(--space-4); }.gm-footer button { min-height:44px; padding:0 var(--space-5); border-radius:999px; font:inherit; font-weight:600; cursor:pointer; }.gm-secondary { background:transparent; color:var(--text); }.gm-primary { background:var(--text); color:var(--bg); }.gm-danger-button { background:#c53d48; color:white; }.gm-footer button:disabled { opacity:.45; cursor:default; }

/* Aligned setting rows share one label and control column. */
.gm-meta { align-items: flex-end; gap: var(--space-4); }
.gm-meta label, .gm-label { color: var(--muted); font-weight: 600; }
.gm-meta input, .gm-label input { min-height: 48px; font-size: var(--text-16); font-weight: 400; }
.gm-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(128px, 152px); column-gap: var(--space-4); min-height: 56px; padding: var(--space-2) 0; }
.gm-row span { min-width: 0; line-height: 1.4; }
.gm-row select { width: 100%; max-width: none; min-height: 44px; padding: var(--space-2) var(--space-3); }
.gm-link { padding-inline: 0; min-height: 56px; }
.gm-link span { font-size: var(--text-14); }
.gm-footer { gap: var(--space-3); margin-top: var(--space-6); }
@media (max-width: 380px) { .gm-dialog { padding: var(--space-4); } .gm-row { grid-template-columns: 1fr; gap: var(--space-2); padding-block: var(--space-2); } .gm-row select { width: 100%; } }
</style>
