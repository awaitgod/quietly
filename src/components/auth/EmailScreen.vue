<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore, friendlyAuthError } from '../../stores/auth'
import SolarIcon from '../common/SolarIcon.vue'
import { savedAccounts } from '../../services/accountStorage'

const emit = defineEmits<{
  (e: 'open-legal', doc: 'terms' | 'policy'): void
  (e: 'open-accounts'): void
}>()

const authStore = useAuthStore()
const email = ref('')
const isAgreed = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref(authStore.authNotice)
authStore.authNotice = ''

// Typewriter effect matching original Quietly
const fullPlaceholder = 'quietly@gmail.com'
const placeholderText = ref('')
let typewriterTimer: any = null
let charIndex = 0
let isDeleting = false

onMounted(() => {
  typewriterTimer = setInterval(() => {
    if (email.value) return // pause when user enters text
    if (!isDeleting) {
      charIndex++
      placeholderText.value = fullPlaceholder.slice(0, charIndex)
      if (charIndex === fullPlaceholder.length) {
        isDeleting = true
        clearInterval(typewriterTimer)
        setTimeout(() => {
          typewriterTimer = setInterval(typeLoop, 120)
        }, 1800)
      }
    } else {
      charIndex--
      placeholderText.value = fullPlaceholder.slice(0, charIndex)
      if (charIndex === 0) {
        isDeleting = false
        clearInterval(typewriterTimer)
        setTimeout(() => {
          typewriterTimer = setInterval(typeLoop, 120)
        }, 600)
      }
    }
  }, 120)

  function typeLoop() {
    if (email.value) return
    if (!isDeleting) {
      charIndex++
      placeholderText.value = fullPlaceholder.slice(0, charIndex)
      if (charIndex === fullPlaceholder.length) {
        isDeleting = true
        clearInterval(typewriterTimer)
        setTimeout(() => {
          typewriterTimer = setInterval(typeLoop, 120)
        }, 1800)
      }
    } else {
      charIndex--
      placeholderText.value = fullPlaceholder.slice(0, charIndex)
      if (charIndex === 0) {
        isDeleting = false
        clearInterval(typewriterTimer)
        setTimeout(() => {
          typewriterTimer = setInterval(typeLoop, 120)
        }, 600)
      }
    }
  }
})

onUnmounted(() => {
  clearInterval(typewriterTimer)
})

const isValidEmail = computed(() => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
})

const canProceed = computed(() => {
  return isValidEmail.value && isAgreed.value && !isSubmitting.value
})

async function handleNext() {
  if (!canProceed.value) return
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const trimmed = email.value.trim().toLowerCase()
    authStore.emailDraft = trimmed

    // Check if account already exists
    const exists = await authStore.checkEmailExists(trimmed)
    if (exists && trimmed === 'platega@gmail.com') {
      authStore.authScreen = 'password_login'
    } else {
      await authStore.sendOtp(trimmed)
    }
  } catch (err: any) {
    errorMessage.value = friendlyAuthError(err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="screen active visible auth-screen">
    <h1>Вход в Quietly</h1>
    <div class="subtitle">Введите ваш email для входа или регистрации</div>

    <div class="field" :class="{ 'has-error': !!errorMessage }">
      <div class="input-wrap">
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          spellcheck="false"
          @keydown.enter="handleNext"
        />
        <div v-if="!email" class="typewriter-placeholder">
          {{ placeholderText }}<span class="type-cursor">|</span>
        </div>
      </div>
    </div>

    <div class="agreement">
      <button
        type="button"
        class="checkbox"
        :class="{ checked: isAgreed }"
        @click="isAgreed = !isAgreed"
      >
        <SolarIcon v-if="isAgreed" name="check-read-bold" :size="14" color="#000000" />
      </button>
      <label @click="isAgreed = !isAgreed">
        Я принимаю
        <a href="#" @click.prevent.stop="emit('open-legal', 'terms')">Условия использования</a>
        и
        <a href="#" @click.prevent.stop="emit('open-legal', 'policy')">Политику конфиденциальности</a>
      </label>
    </div>

    <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>

    <div v-if="savedAccounts().length" class="link-row"><button type="button" class="btn-text" @click="emit('open-accounts')">Другие аккаунты</button></div>
    <div class="bottom-spacer"></div>

    <button
      type="button"
      class="btn-next"
      :class="{ active: canProceed }"
      :disabled="!canProceed"
      @click="handleNext"
    >
      {{ isSubmitting ? 'Отправка...' : 'Продолжить' }}
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
