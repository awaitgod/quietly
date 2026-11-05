<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import SolarIcon from '../common/SolarIcon.vue'

const authStore = useAuthStore()
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

const isLongEnough = computed(() => password.value.length >= 8 && password.value.length <= 72)
const hasLetterAndDigit = computed(() => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,72}$/.test(password.value))
const passwordsMatch = computed(() => password.value === confirmPassword.value)

const canProceed = computed(() => {
  return isLongEnough.value && hasLetterAndDigit.value && passwordsMatch.value && !isSubmitting.value
})

async function handleResetPassword() {
  if (!canProceed.value) return
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await authStore.resetPassword(password.value)
  } catch (err: any) {
    errorMessage.value = err.message || 'Ошибка изменения пароля'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="screen active visible auth-screen">
    <h1>Новый пароль</h1>
    <div class="subtitle">Придумайте новый пароль для входа в Quietly</div>

    <div class="field">
      <div class="input-wrap">
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          class="with-toggle"
          placeholder="Новый пароль"
          autocomplete="new-password"
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
      <div class="hint-row">
        <span class="hint" :class="{ error: password.length > 0 && !isLongEnough }">
          От 8 до 72 символов: латинские буквы и цифры
        </span>
      </div>
    </div>

    <div class="field">
      <div class="input-wrap">
        <input
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Повторите пароль"
          autocomplete="new-password"
          @keydown.enter="handleResetPassword"
        />
      </div>
      <div v-if="confirmPassword.length > 0 && !passwordsMatch" class="error-text">
        Пароли не совпадают
      </div>
    </div>

    <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>

    <div class="link-row"><span class="resend-link" @click="authStore.authScreen = 'password_login'">Назад</span></div>

    <div class="bottom-spacer"></div>

    <button
      type="button"
      class="btn-next"
      :class="{ active: canProceed }"
      :disabled="!canProceed"
      @click="handleResetPassword"
    >
      {{ isSubmitting ? 'Сохранение...' : 'Сохранить' }}
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
