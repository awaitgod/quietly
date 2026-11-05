<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { storageApi, tablesApi } from '../../services/supabase'
const emit = defineEmits<{ (e: 'close'): void; (e: 'created'): void }>()
const auth = useAuthStore(), title = ref(''), files = ref<File[]>([]), urls = ref<string[]>([]), busy = ref(false), error = ref('')
const input = ref<HTMLInputElement | null>(null), first = ref<HTMLInputElement | null>(null), dialog = ref<HTMLElement | null>(null)
const uploaded = new Map<File, string>()
let priorFocus: HTMLElement | null = null
const validTypes = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
onMounted(() => { priorFocus = document.activeElement as HTMLElement; first.value?.focus() })
onUnmounted(() => { urls.value.forEach(URL.revokeObjectURL); priorFocus?.focus() })
function select(event: Event) {
  const target = event.target as HTMLInputElement, incoming = Array.from(target.files || []); target.value = ''
  if (files.value.length + incoming.length > 30) { error.value = 'В наборе может быть не больше 30 файлов.'; return }
  if (incoming.some(f => !validTypes.includes(f.type) || f.size > 25 * 1024 * 1024)) { error.value = 'Выберите изображения или видео MP4/WebM размером до 25 МБ каждый.'; return }
  error.value = ''; files.value.push(...incoming); urls.value.push(...incoming.map(f => URL.createObjectURL(f)))
}
function remove(index: number) { URL.revokeObjectURL(urls.value[index]); files.value.splice(index, 1); urls.value.splice(index, 1) }
function close() { if (!busy.value) emit('close') }
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key !== 'Tab' || !dialog.value) return
  const list = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')).filter(el => el.offsetParent !== null)
  if (!list.length) return
  if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list[list.length - 1].focus() }
  else if (!e.shiftKey && document.activeElement === list[list.length - 1]) { e.preventDefault(); list[0].focus() }
}
async function create() {
  const id = auth.user?.id
  if (!id || !title.value.trim() || !files.value.length || busy.value) return
  busy.value = true; error.value = ''
  try {
    const items: string[] = []
    for (const file of files.value) {
      let url = uploaded.get(file)
      if (!url) {
        const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'} as Record<string,string>)[file.type]
        const result = await storageApi.stickers.uploadSticker(id, file, ext, file.type)
        if (result.error) throw result.error
        url = storageApi.stickers.getPublicUrl(result.data.path); uploaded.set(file, url)
      }
      items.push(url)
    }
    if (auth.user?.id !== id) throw new Error('Сессия изменилась')
    const result = await tablesApi.stickerPacks.createPack({ owner_id: id, title: title.value.trim(), items })
    if (result.error) throw result.error
    emit('created'); emit('close')
  } catch { error.value = 'Не удалось создать набор. Проверьте подключение и попробуйте снова.' }
  finally { busy.value = false }
}
</script>
<template><Teleport to="body"><div class="pack-overlay" @click.self="close" @keydown="onKey"><section ref="dialog" class="pack-dialog" role="dialog" aria-modal="true" aria-labelledby="pack-title"><h2 id="pack-title">Новый стикерпак</h2><form @submit.prevent="create"><label class="pack-label">Название<input ref="first" v-model="title" maxlength="40" placeholder="Название стикерпака" :disabled="busy" /></label><div class="pack-grid"><div v-for="(url, i) in urls" :key="url" class="pack-preview"><video v-if="files[i].type.startsWith('video/')" :src="url" autoplay muted loop playsinline /><img v-else :src="url" alt="" /><button type="button" :disabled="busy" :aria-label="`Удалить файл ${i + 1}`" @click="remove(i)">×</button></div><button v-if="files.length < 30" type="button" class="pack-add" aria-label="Добавить файлы" :disabled="busy" @click="input?.click()">+</button></div><input ref="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden @change="select" /><p class="pack-hint">Фото, WebP, GIF или видео MP4/WebM — до 25 МБ каждый, не больше 30 в наборе.</p><p v-if="error" class="pack-error" role="alert">{{ error }}</p><button class="pack-primary" type="submit" :disabled="busy || !title.trim() || !files.length">{{ busy ? 'Создание…' : 'Создать' }}</button><button class="pack-cancel" type="button" :disabled="busy" @click="close">Отмена</button></form></section></div></Teleport></template>
<style scoped>
.pack-overlay { position:fixed; inset:0; z-index:12000; display:flex; align-items:center; justify-content:center; padding:var(--space-4); background:rgba(0,0,0,.65); }.pack-dialog { width:min(100%,440px); max-height:calc(100dvh - 32px); overflow-y:auto; padding:var(--space-6); border-radius:24px; background:var(--card); color:var(--text); box-shadow:0 24px 70px rgba(0,0,0,.4); }.pack-dialog h2 { margin:0 0 var(--space-4); font-size:var(--text-20); }.pack-label { display:flex; flex-direction:column; gap:var(--space-2); font-size:var(--text-14); }.pack-label input { min-height:48px; background:var(--surface); color:var(--text); font:inherit; }.pack-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--space-2); margin-top:var(--space-4); }.pack-add,.pack-preview { position:relative; aspect-ratio:1; min-width:0; border-radius:var(--radius-md); background:var(--surface); }.pack-add { color:var(--muted); font-size:32px; cursor:pointer; }.pack-preview img,.pack-preview video { width:100%; height:100%; object-fit:contain; }.pack-preview button { position:absolute; top:2px; right:2px; width:24px; height:24px; border-radius:50%; background:var(--card); color:var(--text); cursor:pointer; }.pack-hint { font-size:var(--text-12); color:var(--muted); line-height:1.5; }.pack-error { color:var(--danger); font-size:var(--text-14); }.pack-primary,.pack-cancel { width:100%; min-height:48px; border-radius:var(--radius-md); font:inherit; font-weight:600; cursor:pointer; }.pack-primary { background:var(--text); color:var(--bg); }.pack-primary:disabled { opacity:.45; cursor:default; }.pack-cancel { margin-top:var(--space-2); background:var(--surface); color:var(--text); }
</style>
