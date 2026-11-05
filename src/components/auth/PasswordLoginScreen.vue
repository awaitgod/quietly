<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore, friendlyAuthError } from '../../stores/auth'
import SolarIcon from '../common/SolarIcon.vue'

const authStore = useAuthStore()
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

const canProceed = computed(() => {
  return password.value.length >= 6 && !isSubmitting.value
})

async function handleLogin() {
  if (!canProceed.value) return
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await authStore.loginWithPassword(password.value)
  } catch (err: any) {
    errorMessage.value = friendlyAuthError(err)
  } finally {
    isSubmitting.value = false
  }
}

async function handleForgot() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try { await authStore.beginRecovery() }
  catch (err) { errorMessage.value = friendlyAuthError(err) }
  finally { isSubmitting.value = false }
}

async function changeAccount() {
  try { await authStore.changeEmail() }
  catch (err) { errorMessage.value = friendlyAuthError(err) }
}
</script>

<template>
  <div class="screen active visible auth-screen">
    <h1>Введите пароль</h1>
    <div class="subtitle">
      Аккаунт <b>{{ authStore.emailDraft }}</b>
    </div>

    <div class="field" :class="{ 'has-error': !!errorMessage }">
      <div class="input-wrap">
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          class="with-toggle"
          placeholder="Пароль"
          autocomplete="current-password"
          @keydown.enter="handleLogin"
        />
        <button
          type="button"
          class="pw-toggle"
          :aria-pressed="showPassword"
          @click="showPassword = !showPassword"
        >
          <SolarIcon
            :name="showPassword ? 'eye-closed-linear' : 'eye-linear'"
            :size="20"
            color="var(--muted)"
          />
        </button>
      </div>
      <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>
    </div>

    <div class="link-row">
      <span class="resend-link" @click="handleForgot">Забыли пароль?</span>
    </div>

    <div class="link-row">
      <span class="resend-link" @click="changeAccount">Войти с другого email</span>
    </div>

    <div class="bottom-spacer"></div>

    <button
      type="button"
      class="btn-next"
      :class="{ active: canProceed }"
      :disabled="!canProceed"
      @click="handleLogin"
    >
      {{ isSubmitting ? 'Вход...' : 'Войти' }}
    </button>
  </div>
</template>

<style scoped>
.auth-screen {
  max-width: 440px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: var(--space-10) var(--space-6);
}
</style>
