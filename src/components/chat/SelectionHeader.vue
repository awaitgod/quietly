<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useChatStore } from '../../stores/chat'
import { useGroupsStore } from '../../stores/groups'
import { FAV_ID, rpcApi, supabase, tablesApi } from '../../services/supabase'
import { tauriDeleteMessage } from '../../services/tauriIpc'
import type { Message } from '../../types'
import SolarIcon from '../common/SolarIcon.vue'
const props = defineProps<{ messages: Message[]; isGroup: boolean }>()
const auth = useAuthStore(), chat = useChatStore(), groups = useGroupsStore()
const dialog = ref<'' | 'forward' | 'delete'>(''), busy = ref(false), error = ref(''), target = ref('')
const dialogRef = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null
const selected = computed(() => props.messages.filter(m => chat.selectedMessageIds.has(m.id)))
const selectable = computed(() => props.messages.filter(m => !m.content.startsWith('svc::')))
const allSelected = computed(() => selectable.value.length > 0 && selectable.value.every(m => chat.selectedMessageIds.has(m.id)))
const protectedGroup = computed(() => props.isGroup && !!groups.activeGroup?.no_forward)
const supported = computed(() => selected.value.every(m => !m.deleted_for_all && !m.content.startsWith('e2e1:') && !m.content.startsWith('g2:') && !m.content.startsWith('gift::')))
const own = computed(() => selected.value.every(m => m.sender_id === auth.user?.id))
const canDeleteGroup = computed(() => own.value || groups.activeGroup?.owner_id === auth.user?.id || groups.groupMembers.some(m => m.user_id === auth.user?.id && (m.role === 'owner' || m.role === 'admin')))
const pending = computed(() => selected.value.some(m => m.status === 'sending' || (String(m.id).startsWith('temp_') && !favorite.value)))
const favorite = computed(() => !props.isGroup && chat.activeChat?.id === FAV_ID)
const destinations = computed(() => [
  ...chat.conversationList.map(c => ({ id: `dm:${c.id}`, name: c.profile.name, avatar: c.profile.avatar_url })),
  ...groups.groups.map(g => ({ id: `group:${g.id}`, name: g.name, avatar: g.avatar_url })),
])
watch(dialog, value => { if (value) { returnFocus = document.activeElement as HTMLElement; nextTick(() => dialogRef.value?.focus()) } else { target.value = ''; error.value = ''; nextTick(() => returnFocus?.focus()) } })
function modalKeys(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); close(); return }; if (e.key !== 'Tab' || !dialogRef.value) return; const elements = Array.from(dialogRef.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')).filter(el => el.offsetParent !== null); if (!elements.length) return; if (e.shiftKey && (document.activeElement === elements[0] || document.activeElement === dialogRef.value)) { e.preventDefault(); elements[elements.length - 1].focus() } else if (!e.shiftKey && document.activeElement === elements[elements.length - 1]) { e.preventDefault(); elements[0].focus() } }
function close() { if (!busy.value) dialog.value = '' }
function toggleAll() { chat.selectedMessageIds = allSelected.value ? new Set() : new Set(selectable.value.map(m => m.id)) }
function rawText(m: Message) {
  if (m.content.startsWith('sticker::')) return 'Стикер'
  if (m.content.startsWith('fwd::')) { try { return JSON.parse(m.content.slice(5)).c || '' } catch { return m.content } }
  return m.content
}
async function copy() {
  error.value = ''
  try { await navigator.clipboard.writeText(selected.value.map(rawText).join('\n\n')); chat.exitSelectionMode() }
  catch { error.value = 'Не удалось скопировать сообщения.' }
}
async function remove(all: boolean) {
  if (busy.value || !selected.value.length || pending.value || !auth.user?.id) return
  if (props.isGroup && !canDeleteGroup.value) return
  busy.value = true; error.value = ''
  const list = [...selected.value], failed: Message[] = []; let cacheErrors = 0
  const chatId = props.isGroup ? `grp:${groups.activeGroup?.id}` : String(chat.activeChat?.id || '')
  for (const m of list) {
    try {
      if (props.isGroup) {
        const id = Number(m.id); if (!Number.isSafeInteger(id) || id <= 0) throw new Error()
        const r = await tablesApi.groupMessages.delete(id).select('id'); if (r.error || !r.data?.length) throw r.error || new Error()
        groups.groupMessages = groups.groupMessages.filter(x => String(x.id) !== String(m.id))
      } else if (favorite.value) {
        const r = await supabase.from('quietly_favorite_messages').delete().eq('user_id', auth.user.id).eq('client_id', String(m.id)).select('client_id')
        if (r.error || !r.data?.length) throw r.error || new Error()
        chat.messages = chat.messages.filter(x => String(x.id) !== String(m.id))
      } else {
        await rpcApi.deleteMessage(String(m.id), all)
        chat.messages = chat.messages.filter(x => String(x.id) !== String(m.id))
      }
      try { await tauriDeleteMessage(chatId, m.id) } catch { cacheErrors++ }
      chat.selectedMessageIds.delete(m.id)
    } catch { failed.push(m) }
  }
  busy.value = false
  if (failed.length) { error.value = `Не удалось удалить ${failed.length} из ${list.length}. Они остались выделены; можно повторить.`; return }
  if (cacheErrors) { error.value = 'Сообщения удалены на сервере, но локальный кэш не обновлён. Перезапустите приложение после обновления.'; dialog.value = 'delete'; return }
  chat.exitSelectionMode()
}
async function forward() {
  if (busy.value || !target.value || !auth.user?.id || !supported.value || protectedGroup.value) return
  busy.value = true; error.value = ''; const list = [...selected.value]; const failed: Message[] = []
  const [kind, ...parts] = target.value.split(':'), recipient = parts.join(':'), userId = auth.user.id
  for (const m of list) {
    try {
      let sender = m.sender_id, name = sender === userId ? auth.profile?.name || 'Вы' : groups.groupProfiles.get(sender)?.name || chat.activeChat?.name || 'Участник'
      let content = m.content
      if (content.startsWith('fwd::')) { try { const original = JSON.parse(content.slice(5)); sender = original.u || sender; name = original.n || name; content = original.c || '' } catch {} }
      const forwarded = content.startsWith('sticker::') ? content : `fwd::${JSON.stringify({ u: sender, n: name, c: content })}`
      if (kind === 'group') {
        const result = await tablesApi.groupMessages.insert({ group_id: recipient, sender_id: userId, content: forwarded }); if (result.error) throw result.error
        if (String(groups.activeGroup?.id) === recipient && result.data && !groups.groupMessages.some(x => String(x.id) === String(result.data.id))) groups.groupMessages.push(result.data as Message)
      } else if (recipient === FAV_ID) {
        const clientId = `fwd_${crypto.randomUUID()}`
        const result = await tablesApi.quietlyFavoriteMessages.syncLocalToServer({ user_id: userId, client_id: clientId, content: forwarded, created_at: new Date().toISOString(), original_sender_id: sender })
        if (result.error) throw result.error
      } else {
        const result = await tablesApi.messages.insertMessage({ sender_id: userId, receiver_id: recipient, content: forwarded }); if (result.error) throw result.error
        if (String(chat.activeChat?.id) === recipient && result.data && !chat.messages.some(x => String(x.id) === String(result.data.id))) chat.messages.push(result.data as Message)
      }
      chat.selectedMessageIds.delete(m.id)
    } catch { failed.push(m) }
  }
  busy.value = false
  void chat.loadConversations(); void groups.loadUserGroups()
  if (failed.length) { error.value = `Не удалось переслать ${failed.length} из ${list.length}. Они остались выделены; можно повторить.`; return }
  chat.exitSelectionMode()
}
</script>
<template>
  <header class="selection-header" aria-label="Выбранные сообщения">
    <button type="button" class="selection-icon" aria-label="Отменить выбор" @click="chat.exitSelectionMode()"><SolarIcon name="close-linear" :size="20" /></button>
    <strong class="selection-count">Выбрано: {{ selected.length }}</strong>
    <button type="button" class="selection-action" :aria-label="allSelected ? 'Снять выбор' : 'Выбрать все'" :aria-pressed="allSelected" @click="toggleAll"><SolarIcon name="checklist-minimalistic-linear" :size="20" /><span>{{ allSelected ? 'Снять выбор' : 'Выбрать все' }}</span></button>
    <button type="button" class="selection-icon" aria-label="Копировать выбранные сообщения" title="Копировать" :disabled="!selected.length || !supported || protectedGroup" @click="copy"><SolarIcon name="copy-linear" :size="21" /></button>
    <button type="button" class="selection-icon" aria-label="Переслать выбранные сообщения" title="Переслать" :disabled="!selected.length || !supported || protectedGroup || pending" @click="dialog = 'forward'"><SolarIcon name="forward-linear" :size="21" /></button>
    <button type="button" class="selection-icon danger" aria-label="Удалить выбранные сообщения" title="Удалить" :disabled="!selected.length || pending || (isGroup && !canDeleteGroup)" @click="dialog = 'delete'"><SolarIcon name="trash-bin-trash-linear" :size="21" /></button>
    <span v-if="error && !dialog" class="selection-error" role="alert">{{ error }}</span>
  </header>
  <Teleport to="body"><div v-if="dialog" class="selection-overlay" @click.self="close" @keydown="modalKeys"><section ref="dialogRef" tabindex="-1" class="selection-dialog" role="dialog" aria-modal="true" :aria-label="dialog === 'delete' ? 'Удалить сообщения' : 'Переслать сообщения'"><h2>{{ dialog === 'delete' ? 'Удалить сообщения?' : 'Переслать сообщения' }}</h2>
    <template v-if="dialog === 'delete'"><p>Выбрано: {{ selected.length }}. {{ isGroup ? 'Сообщения будут удалены из группы.' : favorite ? 'Сообщения будут удалены из избранного.' : 'Выберите, для кого удалить сообщения.' }}</p></template>
    <template v-else><p>Выберите чат для пересылки. Стикеры отправляются без подписи автора.</p><div class="destination-list"><label v-for="d in destinations" :key="d.id" class="destination"><input v-model="target" type="radio" name="forward-target" :value="d.id" /><span>{{ d.name }}</span></label><p v-if="!destinations.length">Нет доступных чатов.</p></div></template>
    <p v-if="error" class="dialog-error" role="alert">{{ error }}</p><footer><button type="button" class="secondary" :disabled="busy" @click="close">Отмена</button><button v-if="dialog === 'forward'" type="button" class="primary" :disabled="busy || !target" @click="forward">{{ busy ? 'Отправка…' : 'Переслать' }}</button><template v-else><button type="button" class="danger-button" :disabled="busy" @click="remove(false)">{{ busy ? 'Удаление…' : isGroup || favorite ? 'Удалить' : 'Удалить у меня' }}</button><button v-if="!isGroup && !favorite && own" type="button" class="danger-button" :disabled="busy" @click="remove(true)">У всех</button></template></footer></section></div></Teleport>
</template>
<style scoped>
.selection-header { min-height:var(--header-height); display:flex; align-items:center; gap:var(--space-2); padding:0 var(--space-4); color:var(--text); flex:none; }.selection-count { flex:1; min-width:0; font-size:var(--text-16); }.selection-icon { width:40px; height:40px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--surface); color:var(--text); cursor:pointer; }.selection-icon:disabled,.selection-action:disabled { opacity:.5; cursor:default; }
.selection-icon,.selection-action { transition: background-color .16s ease, color .16s ease, transform .16s cubic-bezier(.2,.8,.2,1), opacity .16s ease; }
.selection-icon:not(:disabled):hover,.selection-action:hover { background: var(--card); }
.selection-icon:not(:disabled):active,.selection-action:active { transform: scale(.94); }.selection-icon.danger { color:var(--danger); }.selection-action { display:inline-flex; align-items:center; justify-content:center; gap:var(--space-2); min-height:40px; padding:0 var(--space-3); border-radius:var(--radius-md); background:transparent; color:var(--text); font:inherit; font-size:var(--text-14); cursor:pointer; }.selection-error { position:absolute; top:72px; left:50%; transform:translateX(-50%); padding:var(--space-3); border-radius:var(--radius-md); background:var(--surface); z-index:20; color:var(--danger); }
.selection-overlay { position:fixed; inset:0; z-index:12000; display:flex; align-items:center; justify-content:center; padding:var(--space-4); }.selection-dialog { width:min(100%,440px); max-height:calc(100dvh - 32px); display:flex; flex-direction:column; padding:var(--space-6); border-radius:24px; color:var(--text); background:var(--card); box-shadow:0 24px 70px rgba(0,0,0,.4); }.selection-dialog h2 { margin:0; font-size:var(--text-20); }.selection-dialog p { color:var(--muted); font-size:var(--text-14); line-height:1.5; }.destination-list { min-height:0; overflow:auto; }.destination { display:flex; align-items:center; gap:var(--space-3); min-height:48px; padding:var(--space-2); border-radius:var(--radius-md); cursor:pointer; }.destination:hover { background:var(--surface); }.destination input { width:18px; height:18px; margin:0; }.selection-dialog footer { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:var(--space-2); margin-top:var(--space-4); }.selection-dialog footer button { min-height:44px; padding:0 var(--space-4); border-radius:999px; font:inherit; font-weight:600; cursor:pointer; }.selection-dialog button:disabled { opacity:.45; cursor:default; }.secondary { background:transparent; color:var(--text); }.primary { background:var(--text); color:var(--bg); }.danger-button { background:#be3f4a; color:white; }.selection-dialog .dialog-error { color:var(--danger); }
@media (max-width:600px) { .selection-action { width:36px; padding:0; background:var(--surface); border-radius:50%; } .selection-action span { display:none; }.selection-header { gap:var(--space-1); padding-inline:var(--space-2); }.selection-icon { width:36px; height:36px; } }
@media (prefers-reduced-motion: reduce) { .selection-icon,.selection-action { transition:none; } }
</style>
