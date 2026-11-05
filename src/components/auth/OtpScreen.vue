<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore, friendlyAuthError } from '../../stores/auth'

const authStore = useAuthStore()
const digits = ref(['', '', '', '', '', ''])
const inputRefs = ref<HTMLInputElement[]>([])
const isVerifying = ref(false)
const errorMessage = ref('')

onMounted(() => {
  setTimeout(() => {
    inputRefs.value[0]?.focus()
  }, 100)
})

function onInput(index: number, e: Event) {
  const target = e.target as HTMLInputElement
  const val = target.value.replace(/[^0-9]/g, '')
  digits.value[index] = val ? val[val.length - 1] : ''
  errorMessage.value = ''

  if (val && index < 5) {
    inputRefs.value[index + 1]?.focus()
  }

  // Auto-submit when all 6 digits entered
  if (digits.value.every((d) => d !== '')) {
    submitOtp()
  }
}

function onKeyDown(index: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[index] && index > 0) {
    inputRefs.value[index - 1]?.focus()
  }
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text') || ''
  const nums = text.replace(/[^0-9]/g, '').slice(0, 6)
  for (let i = 0; i < nums.length; i++) {
    digits.value[i] = nums[i]
  }
  if (nums.length === 6) {
    submitOtp()
  } else if (nums.length > 0) {
    inputRefs.value[Math.min(nums.length, 5)]?.focus()
  }
}

async function submitOtp() {
  const code = digits.value.join('')
  if (code.length !== 6 || isVerifying.value) return

  isVerifying.value = true
  errorMessage.value = ''

  try {
    await authStore.verifyOtp(code)
  } catch (err: any) {
    errorMessage.value = friendlyAuthError(err)
  } finally {
    isVerifying.value = false
  }
}

async function resendCode() {
  if (authStore.otpCountdown > 0) return
  try {
    await authStore.sendOtp(authStore.emailDraft)
  } catch (err: any) {
    errorMessage.value = friendlyAuthError(err)
  }
}

function changeEmail() {
  authStore.authScreen = 'email'
}
</script>

<template>
  <div class="screen active visible auth-screen">
    <h1>Код подтверждения</h1>
    <div class="subtitle">
      Мы отправили 6-значный код на <b>{{ authStore.emailDraft }}</b>
    </div>

    <div class="otp-row" :class="{ error: !!errorMessage }">
      <input
        v-for="(_, index) in digits"
        :key="index"
        :ref="(el) => { if (el) inputRefs[index] = el as HTMLInputElement }"
        v-model="digits[index]"
        type="text"
        inputmode="numeric"
        maxlength="1"
        class="otp-box"
        :class="{ filled: !!digits[index] }"
        @input="onInput(index, $event)"
        @keydown="onKeyDown(index, $event)"
        @paste="onPaste"
      />
    </div>

    <div v-if="errorMessage" class="error-text">{{ errorMessage }}</div>

    <div class="link-row">
      <span
        class="resend-link"
        :class="{ disabled: authStore.otpCountdown > 0 }"
        @click="resendCode"
      >
        {{
          authStore.otpCountdown > 0
            ? `Отправить повторно через ${authStore.otpCountdown} с`
            : 'Отправить код повторно'
        }}
      </span>
    </div>

    <div class="link-row">
      <span class="resend-link" @click="changeEmail">Изменить email</span>
    </div>

    <div class="bottom-spacer"></div>

    <button
      type="button"
      class="btn-next"
      :class="{ active: digits.every((d) => d !== '') && !isVerifying }"
      :disabled="!digits.every((d) => d !== '') || isVerifying"
      @click="submitOtp"
    >
      {{ isVerifying ? 'Проверка...' : 'Подтвердить' }}
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
