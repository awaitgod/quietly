<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { authApi, tablesApi } from '../../services/supabase'
import { friendlyAuthError, useAuthStore } from '../../stores/auth'
import { useContactsStore } from '../../stores/contacts'
import type { UserProfile } from '../../types'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{ (event: 'back'): void }>()
const auth = useAuthStore()
const contacts = useContactsStore()

const view = ref<'main' | 'password' | 'blocked'>('main')

// Password view state
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref('')

// Blocked users view state
const blocked = ref<UserProfile[]>([])
const search = ref('')
const results = ref<UserProfile[]>([])
const searching = ref(false)
const listLoading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSequence = 0

const isLongEnough = computed(() => newPassword.value.length >= 8 && newPassword.value.length <= 72)
const hasLetterAndDigit = computed(() => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,72}$/.test(newPassword.value))
const passwordsMatch = computed(() => newPassword.value === confirmPassword.value)
const canSave = computed(() => !!currentPassword.value && isLongEnough.value && hasLetterAndDigit.value && passwordsMatch.value && !busy.value)

function open(next: 'main' | 'password' | 'blocked') {
  searchSequence++
  clearTimeout(searchTimer)
  view.value = next
  error.value = ''
  success.value = ''
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showCurrentPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
  search.value = ''
  results.value = []
  searching.value = false
  if (next === 'blocked') void loadBlocked()
}

function back() {
  if (view.value === 'main') {
    emit('back')
  } else {
    open('main')
  }
}

async function changePassword() {
  if (!canSave.value || !auth.user?.email) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await authApi.changePassword(auth.user.email, currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    success.value = 'Пароль успешно изменён'
  } catch (err) {
    error.value = friendlyAuthError(err)
  } finally {
    busy.value = false
  }
}

async function loadBlocked() {
  if (!auth.user?.id) return
  const id = auth.user.id
  listLoading.value = true
  error.value = ''
  try {
    const response = await tablesApi.blockedUsers.loadBlocked(id)
    if (response.error) throw response.error
    const ids: string[] = (response.data || []).map(row => row.blocked_id)
    const profiles = ids.length ? await tablesApi.profiles.getByIds(ids) : { data: [], error: null }
    if (profiles.error) throw profiles.error
    if (auth.user?.id !== id) return
    const byId = new Map((profiles.data || []).map(profile => [profile.id, profile as UserProfile]))
    blocked.value = ids.map(userId => byId.get(userId) || { id: userId, name: 'Пользователь', username: '' })
    contacts.blockedIds = new Set(ids)
  } catch (err) {
    error.value = friendlyAuthError(err)
  } finally {
    listLoading.value = false
  }
}

function searchUsers() {
  const sequence = ++searchSequence
  clearTimeout(searchTimer)
  results.value = []
  const query = search.value.trim().replace(/^@/, '')
  if (!query || !auth.user?.id) {
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const response = await tablesApi.profiles.searchByUsername(query, auth.user.id, 15)
      if (response.error) throw response.error
      if (sequence === searchSequence) {
        results.value = (response.data || []) as UserProfile[]
      }
    } catch (err) {
      if (sequence === searchSequence) error.value = friendlyAuthError(err)
    } finally {
      if (sequence === searchSequence) searching.value = false
    }
  }, 300)
}

async function toggleBlock(user: UserProfile) {
  if (busy.value || !auth.user?.id || user.id === auth.user.id) return
  busy.value = true
  error.value = ''
  try {
    if (contacts.blockedIds.has(user.id)) {
      await contacts.unblockUser(user.id)
    } else {
      await contacts.blockUser(user.id)
    }
    await loadBlocked()
  } catch (err) {
    error.value = friendlyAuthError(err)
  } finally {
    busy.value = false
  }
}

onUnmounted(() => {
  searchSequence++
  clearTimeout(searchTimer)
})
</script>

<template>
  <div class="st-view">
    <!-- Header -->
    <div class="sg-head">
      <button
        type="button"
        class="back-circle"
        aria-label="Назад"
        @click="back"
      >
        <SolarIcon name="alt-arrow-left-linear" :size="22" color="#ffffff" />
      </button>
      <h2 class="sg-title">
        {{ view === 'main' ? 'Безопасность' : view === 'password' ? 'Сменить пароль' : 'Чёрный список' }}
      </h2>
    </div>

    <!-- MAIN VIEW (Matches screenshot) -->
    <template v-if="view === 'main'">
      <div class="sg-sec">ВХОД</div>
      <button
        type="button"
        class="sec-card-btn"
        @click="open('password')"
      >
        <div class="sec-btn-content">
          <div class="sec-btn-title">Сменить пароль</div>
        </div>
        <SolarIcon name="alt-arrow-right-linear" :size="20" color="#71717a" />
      </button>

      <div class="sg-sec" style="margin-top: 24px;">ИНФОРМАЦИЯ</div>
      <button
        type="button"
        class="sec-card-btn"
        @click="open('blocked')"
      >
        <div class="sec-btn-content">
          <div class="sec-btn-title">Чёрный список</div>
          <div class="sec-btn-sub">Список тех, чьи сообщения вам не приходят</div>
        </div>
        <SolarIcon name="alt-arrow-right-linear" :size="20" color="#71717a" />
      </button>
    </template>

    <!-- SUBVIEW: CHANGE PASSWORD -->
    <form v-else-if="view === 'password'" class="sec-form" @submit.prevent="changePassword">
      <p class="sg-note">
        Введите текущий пароль и придумайте новый для защиты вашего аккаунта.
      </p>

      <!-- Current Password -->
      <div class="field">
        <label class="input-label">Текущий пароль</label>
        <div class="input-wrap">
          <input
            v-model="currentPassword"
            :type="showCurrentPassword ? 'text' : 'password'"
            class="with-toggle"
            placeholder="Введите текущий пароль"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="pw-toggle"
            :aria-pressed="showCurrentPassword"
            @click="showCurrentPassword = !showCurrentPassword"
          >
            <SolarIcon
              :name="showCurrentPassword ? 'eye-closed-linear' : 'eye-linear'"
              :size="20"
              color="var(--muted)"
            />
          </button>
        </div>
      </div>

      <!-- New Password -->
      <div class="field">
        <label class="input-label">Новый пароль</label>
        <div class="input-wrap">
          <input
            v-model="newPassword"
            :type="showNewPassword ? 'text' : 'password'"
            class="with-toggle"
            placeholder="Новый пароль"
            autocomplete="new-password"
            maxlength="72"
          />
          <button
            type="button"
            class="pw-toggle"
            :aria-pressed="showNewPassword"
            @click="showNewPassword = !showNewPassword"
          >
            <SolarIcon
              :name="showNewPassword ? 'eye-closed-linear' : 'eye-linear'"
              :size="20"
              color="var(--muted)"
            />
          </button>
        </div>
        <div class="hint-row">
          <span class="hint" :class="{ error: newPassword.length > 0 && (!isLongEnough || !hasLetterAndDigit) }">
            От 8 до 72 символов: латинские буквы и цифры
          </span>
        </div>
      </div>

      <!-- Confirm New Password -->
      <div class="field">
        <label class="input-label">Повторите пароль</label>
        <div class="input-wrap">
          <input
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            class="with-toggle"
            placeholder="Повторите новый пароль"
            autocomplete="new-password"
            maxlength="72"
          />
          <button
            type="button"
            class="pw-toggle"
            :aria-pressed="showConfirmPassword"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <SolarIcon
              :name="showConfirmPassword ? 'eye-closed-linear' : 'eye-linear'"
              :size="20"
              color="var(--muted)"
            />
          </button>
        </div>
        <div v-if="confirmPassword.length > 0 && !passwordsMatch" class="hint-row">
          <span class="hint error">Пароли не совпадают</span>
        </div>
      </div>

      <div v-if="error" class="sec-alert error">{{ error }}</div>
      <div v-if="success" class="sec-alert success">{{ success }}</div>

      <button
        type="submit"
        class="btn-save"
        :class="{ active: canSave }"
        :disabled="!canSave"
      >
        {{ busy ? 'Сохранение...' : 'Сменить пароль' }}
      </button>
    </form>

    <!-- SUBVIEW: BLACKLIST -->
    <div v-else class="sec-blocked-view">
      <p class="sg-note">
        Найдите пользователя по юзернейму, чтобы добавить в чёрный список или удалить из него.
      </p>

      <div class="search-input-wrap">
        <SolarIcon name="magnifer-linear" :size="18" color="#71717a" class="search-ic" />
        <input
          v-model="search"
          type="text"
          class="sec-search-input"
          placeholder="Поиск по юзернейму (@username)..."
          autocomplete="off"
          @input="searchUsers"
        />
        <button
          v-if="search"
          type="button"
          class="search-clear-btn"
          @click="search = ''; results = []"
        >
          <SolarIcon name="close-circle-bold" :size="16" color="#71717a" />
        </button>
      </div>

      <div v-if="error" class="sec-alert error">{{ error }}</div>

      <!-- Search results -->
      <div v-if="search.trim()" class="sec-users-group">
        <div class="sg-sec">РЕЗУЛЬТАТЫ ПОИСКА</div>
        <p v-if="searching" class="sec-empty-note">Поиск...</p>
        <p v-else-if="!results.length" class="sec-empty-note">Пользователи не найдены</p>
        <div v-else class="sec-user-list">
          <div v-for="user in results" :key="user.id" class="sec-user-row">
            <div class="sec-user-avatar">
              <img v-if="user.avatar_url" :src="user.avatar_url" alt="" />
              <span v-else>{{ (user.name || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <div class="sec-user-meta">
              <div class="sec-user-name">{{ user.name }}</div>
              <div v-if="user.username" class="sec-user-sub">@{{ user.username }}</div>
            </div>
            <button
              type="button"
              class="sec-action-btn"
              :class="{ danger: !contacts.blockedIds.has(user.id), secondary: contacts.blockedIds.has(user.id) }"
              :disabled="busy"
              @click="toggleBlock(user)"
            >
              {{ contacts.blockedIds.has(user.id) ? 'Разблокировать' : 'Заблокировать' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Currently Blocked List -->
      <div class="sg-sec" style="margin-top: 24px;">ЗАБЛОКИРОВАННЫЕ</div>
      <p v-if="listLoading" class="sec-empty-note">Загрузка...</p>
      <p v-else-if="!blocked.length && !error" class="sec-empty-note">В чёрном списке никого нет</p>
      <div v-else class="sec-user-list">
        <div v-for="user in blocked" :key="user.id" class="sec-user-row">
          <div class="sec-user-avatar">
            <img v-if="user.avatar_url" :src="user.avatar_url" alt="" />
            <span v-else>{{ (user.name || '?').charAt(0).toUpperCase() }}</span>
          </div>
          <div class="sec-user-meta">
            <div class="sec-user-name">{{ user.name }}</div>
            <div v-if="user.username" class="sec-user-sub">@{{ user.username }}</div>
          </div>
          <button
            type="button"
            class="sec-action-btn secondary"
            :disabled="busy"
            @click="toggleBlock(user)"
          >
            Разблокировать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st-view {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.sg-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 40px;
  margin: 0 0 var(--space-6);
}

.back-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s, background-color 0.15s;
}

.back-circle:hover {
  opacity: 0.85;
}

:global(html[data-theme="light"]) .back-circle svg {
  color: #17171b !important;
}

.sg-title {
  font-family: Unbounded, sans-serif;
  font-size: var(--page-title-size);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.sg-sec {
  font-size: var(--text-12);
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #71717a;
  text-transform: uppercase;
  margin-top: 14px;
  margin-bottom: 8px;
  padding-left: 2px;
}

.sg-note {
  font-size: var(--text-14);
  color: #8e8e96;
  margin: 0 0 var(--space-4);
  line-height: 1.45;
}

/* Card Button matching screenshot */
.sec-card-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 18px;
  background: #1e1e24;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.sec-card-btn:hover {
  background-color: #26262e;
}

:global(html[data-theme="light"]) .sec-card-btn {
  background: #f4f4f7;
  border-color: rgba(0, 0, 0, 0.06);
}

:global(html[data-theme="light"]) .sec-card-btn:hover {
  background: #eaebee;
}

.sec-btn-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.sec-btn-title {
  font-size: var(--text-16);
  font-weight: 600;
  color: var(--text);
}

.sec-btn-sub {
  font-size: var(--text-13);
  color: #8e8e96;
  line-height: 1.35;
}

/* Form inputs */
.sec-form {
  display: flex;
  flex-direction: column;
}

.input-label {
  display: block;
  font-size: var(--text-13);
  font-weight: 500;
  color: #a1a1aa;
  margin-bottom: 6px;
  padding-left: 2px;
}

.field {
  margin-bottom: 14px;
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background-color: var(--surface);
  color: #fff;
  font-size: var(--text-15);
  outline: none;
  transition: border-color 0.2s;
}

:global(html[data-theme="light"]) .input-wrap input {
  background-color: #f4f4f7;
  color: #17171b;
  border-color: rgba(0, 0, 0, 0.08);
}

.input-wrap input:focus {
  border-color: #0a84ff;
}

input.with-toggle {
  padding-right: 48px;
}

.pw-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hint-row {
  margin-top: 6px;
  padding-left: 4px;
}

.hint {
  font-size: var(--text-12);
  color: #71717a;
}

.hint.error {
  color: #f87171;
}

.sec-alert {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: var(--text-14);
  margin-bottom: 14px;
}

.sec-alert.error {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
}

.sec-alert.success {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.btn-save {
  margin-top: 8px;
  padding: 14px 28px;
  border: none;
  border-radius: 999px;
  background-color: #3a3a42;
  color: #8e8e96;
  font-family: Unbounded, Montserrat, sans-serif;
  font-size: var(--text-14);
  font-weight: 600;
  letter-spacing: 0.3px;
  cursor: not-allowed;
  transition: background-color 0.2s, color 0.2s;
  align-self: flex-start;
}

.btn-save.active {
  background-color: #ffffff;
  color: #111113;
  cursor: pointer;
}

.btn-save.active:hover {
  background-color: #e4e4e7;
}

/* Search input for blacklist */
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.search-ic {
  position: absolute;
  left: 14px;
  pointer-events: none;
}

.sec-search-input {
  width: 100%;
  padding: 13px 40px 13px 40px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background-color: var(--surface);
  color: #fff;
  font-size: var(--text-14);
  outline: none;
}

:global(html[data-theme="light"]) .sec-search-input {
  background-color: #f4f4f7;
  color: #17171b;
  border-color: rgba(0, 0, 0, 0.08);
}

.sec-search-input:focus {
  border-color: #0a84ff;
}

.search-clear-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
}

.sec-empty-note {
  font-size: var(--text-14);
  color: #71717a;
  padding: 8px 4px;
  margin: 0;
}

/* User lists in Blacklist */
.sec-user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sec-user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--ui-border);
}

.sec-user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.sec-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sec-user-meta {
  flex: 1;
  min-width: 0;
}

.sec-user-name {
  font-size: var(--text-14);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sec-user-sub {
  font-size: var(--text-12);
  color: #8e8e96;
}

.sec-action-btn {
  padding: 7px 14px;
  border-radius: 999px;
  font-size: var(--text-12);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s, background-color 0.15s;
}

.sec-action-btn.danger {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.sec-action-btn.danger:hover {
  background: rgba(248, 113, 113, 0.25);
}

.sec-action-btn.secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sec-action-btn.secondary:hover {
  opacity: 0.85;
}

.sec-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
