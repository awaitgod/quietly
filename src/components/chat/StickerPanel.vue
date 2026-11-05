<script setup lang="ts">
import EmojiText from '../common/EmojiText.vue'

import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import type { StickerPack } from '../../types'
import { EMOJI_CATEGORIES, OFFICIAL_PACKS, tablesApi } from '../../services/supabase'
import { stickerUrl, isVideoSticker } from '../../utils/stickers'
import StickerPackCreateModal from '../modals/StickerPackCreateModal.vue'
import StickerPackPreview from '../modals/StickerPackPreview.vue'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'select-emoji', emoji: string): void
  (e: 'select-sticker', src: string): void
  (e: 'close'): void
}>()

const activeTab = ref<'emoji' | 'stickers'>('stickers')
const auth = useAuthStore()
const packs = ref<StickerPack[]>([])
const loading = ref(false)
const loadError = ref('')
async function loadPacks() {
  if (!auth.user?.id) return
  loading.value = true
  loadError.value = ''
  try {
    const { data, error } = await tablesApi.stickerPacks.loadUserPacks(auth.user.id)
    if (error) throw error
    packs.value = (data || []).filter(p => Array.isArray(p.items)) as StickerPack[]
  } catch { loadError.value = 'Не удалось загрузить стикеры.' }
  finally { loading.value = false }
}
const creating = ref(false)
const previewPack = ref<{ id: string; title: string; items: string[]; official: boolean } | null>(null)
const activePack = ref('welcome')
const addedOfficial = ref<string[]>(['welcome'])
const packKey = computed(() => `chat_packs_added:${auth.user?.id || 'guest'}`)
function readAdded() { try { const saved = localStorage.getItem(packKey.value); const parsed = saved ? JSON.parse(saved) : ['welcome']; addedOfficial.value = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && OFFICIAL_PACKS.some(p => p.id === id)) : ['welcome'] } catch { addedOfficial.value = ['welcome'] } }
function toggleOfficial(id: string) { addedOfficial.value = addedOfficial.value.includes(id) ? addedOfficial.value.filter(x => x !== id) : [...addedOfficial.value, id]; try { localStorage.setItem(packKey.value, JSON.stringify(addedOfficial.value)) } catch {} if (!addedOfficial.value.includes(activePack.value)) activePack.value = addedOfficial.value[0] || (packs.value[0] ? `user:${packs.value[0].id}` : 'catalog') }
const visiblePacks = computed(() => [...OFFICIAL_PACKS.filter(p => addedOfficial.value.includes(p.id)).map(p => ({ ...p, key: p.id })), ...packs.value.map(p => ({ ...p, key: `user:${p.id}` }))])
const currentPack = computed(() => visiblePacks.value.find(p => p.key === activePack.value))
readAdded()
onMounted(loadPacks)

function handleEmojiClick(e: string) {
  emit('select-emoji', e)
}

function handleStickerClick(src: string) {
  emit('select-sticker', src)
}
</script>

<template>
  <div class="sticker-panel">
    <!-- Body -->
    <div class="sp-body">
      <!-- Stickers tab -->
      <div v-if="activeTab === 'stickers'" class="sp-content">
        <div class="sp-top" aria-label="Наборы стикеров"><button v-for="pack in visiblePacks" :key="pack.key" type="button" class="sp-pack-tab" :class="{ on: activePack === pack.key }" :aria-label="pack.title" :aria-pressed="activePack === pack.key" @click="activePack = pack.key"><video v-if="pack.items[0] && isVideoSticker(pack.items[0])" :src="stickerUrl(pack.items[0])" muted loop autoplay playsinline /><img v-else-if="pack.items[0]" :src="stickerUrl(pack.items[0])" alt="" /><span v-else>{{ pack.title.charAt(0) }}</span></button><button type="button" class="sp-pack-tab" aria-label="Добавить наборы" :aria-pressed="activePack === 'catalog'" @click="activePack = 'catalog'">+</button><button type="button" class="sp-pack-tab" aria-label="Создать стикерпак" @click="creating = true"><SolarIcon name="add-circle-linear" :size="22" /></button></div>
        <div v-if="activePack === 'catalog'" class="sp-catalog"><div v-for="pack in OFFICIAL_PACKS" :key="pack.id" class="sp-catalog-row"><button type="button" class="sp-catalog-title" @click="previewPack = { ...pack, official: true }">{{ pack.title }}</button><button type="button" @click="toggleOfficial(pack.id)">{{ addedOfficial.includes(pack.id) ? 'Убрать' : 'Добавить' }}</button></div></div>
        <p v-if="loading" class="sp-status" role="status">Загрузка ваших наборов…</p>
        <div v-else-if="loadError" class="sp-status" role="alert">{{ loadError }} <button type="button" @click="loadPacks">Повторить</button></div>
        <div v-if="currentPack" :key="currentPack.key" class="sp-pack"><template v-for="pack in [currentPack]" :key="pack.key">
          <div class="sp-head">
            <button type="button" class="sp-pack-title" @click="previewPack = { id: String(pack.id), title: pack.title, items: pack.items, official: OFFICIAL_PACKS.some(p => p.id === pack.key) }">{{ pack.title }} <span aria-hidden="true">›</span></button>
            <small>{{ pack.items.length }} стикеров</small>
          </div>
          <div class="sp-grid">
            <button
              v-for="item in pack.items"
              :key="item"
              type="button"
              class="sp-cell"
              @click="handleStickerClick(item)"
            >
              <video v-if="isVideoSticker(item)" :src="stickerUrl(item)" autoplay muted loop playsinline aria-label="Стикер" />
              <img v-else :src="stickerUrl(item)" alt="Стикер недоступен" loading="lazy" />
            </button>
          </div>
          </template></div>
      </div>

      <!-- Emoji tab -->
      <div v-else class="sp-content">
        <div v-for="cat in EMOJI_CATEGORIES" :key="cat.title" class="em-sec">
          <div class="em-title">{{ cat.title }}</div>
          <div class="sp-grid emoji">
            <button
              v-for="e in cat.list"
              :key="e"
              type="button"
              class="sp-cell"
              @click="handleEmojiClick(e)"
            >
              <EmojiText :text="e" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom tab selector -->
    <div class="sp-bottom">
      <button
        type="button"
        class="sp-seg"
        :class="{ on: activeTab === 'emoji' }"
        @click="activeTab = 'emoji'"
      >
        Эмодзи
      </button>
      <button
        type="button"
        class="sp-seg"
        :class="{ on: activeTab === 'stickers' }"
        @click="activeTab = 'stickers'"
      >
        Стикеры
      </button>
    </div>
    <StickerPackPreview v-if="previewPack" :pack="previewPack" :official="previewPack.official" :added="addedOfficial.includes(previewPack.id)" @close="previewPack = null" @toggle="toggleOfficial(previewPack!.id)" @select="handleStickerClick" />
    <StickerPackCreateModal v-if="creating" @close="creating = false" @created="loadPacks" />
  </div>
</template>

<style scoped>
.sticker-panel {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 0;
  right: auto;
  width: min(320px, calc(100vw - 32px));
  height: min(380px, 60dvh);
  background-color: var(--surface);
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  z-index: 40;
}

.sp-pack-title { padding: 0; background: transparent; color: var(--text); font: inherit; font-size: var(--text-14); font-weight: 600; cursor: pointer; }
.sp-catalog-title { flex:1; text-align:left; }
.sp-status { color: var(--muted); font-size: var(--text-14); line-height: 1.5; }
.sp-status button { color: var(--text); background: transparent; cursor: pointer; text-decoration: underline; }
.sp-top { display:flex; gap:var(--space-1); overflow-x:auto; margin-bottom:var(--space-3); }
.sp-pack-tab { flex:none; width:40px; height:40px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; background:transparent; color:var(--text); font-size:24px; cursor:pointer; }.sp-pack-tab.on { background:var(--card); }.sp-pack-tab img,.sp-pack-tab video { width:32px; height:32px; object-fit:contain; }
.sp-catalog-row { display:flex; justify-content:space-between; align-items:center; padding:var(--space-2); color:var(--text); }.sp-catalog-row button { padding:var(--space-2); border-radius:var(--radius-md); background:var(--card); color:var(--text); cursor:pointer; }
.sp-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
}

.sp-pack {
  margin-bottom: var(--space-4);
}

.sp-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.sp-head h4 {
  margin: 0;
  font-size: var(--text-14);
  font-weight: 600;
  color: var(--text);
}

.sp-head small {
  font-size: var(--text-12);
  color: var(--muted);
}

.sp-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.sp-grid.emoji {
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
}

.sp-cell {
  aspect-ratio: 1;
  background: transparent;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-24);
  cursor: pointer;
  transition: transform 0.15s, background-color 0.15s;
}

.sp-cell:hover {
  background-color: rgba(255, 255, 255, 0.08);
  transform: scale(1.08);
}

.sp-cell img, .sp-cell video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.em-title {
  font-size: var(--text-12);
  font-weight: 600;
  color: var(--muted);
  margin: var(--space-2) 0 var(--space-1-5);
}

.sp-bottom {
  display: flex;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: var(--space-1-5);
  gap: var(--space-1-5);
  background-color: var(--bg);
}

.sp-seg {
  flex: 1;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: var(--text-14);
  font-weight: 600;
  cursor: pointer;
}

.sp-seg.on {
  background-color: var(--surface);
  color: #fff;
}
</style>
