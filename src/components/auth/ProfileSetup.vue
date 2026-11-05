<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore, friendlyAuthError } from '../../stores/auth'
import { supabase } from '../../services/supabase'
import SolarIcon from '../common/SolarIcon.vue'

const emit = defineEmits<{
  (e: 'open-cropper', file: File): void
}>()

const authStore = useAuthStore()
const name = ref('')
const username = ref('')
const avatarPreview = ref<string | null>(null)
const avatarBlob = ref<Blob | undefined>()
const fileInputRef = ref<HTMLInputElement | null>(null)

const isCheckingUsername = ref(false)
const usernameError = ref('')
const generalError = ref('')
const isSubmitting = ref(false)

const isValidName = computed(() => {
  const len = name.value.trim().length
  return len >= 2 && len <= 24
})

const isValidUsername = computed(() => {
  return /^[a-z0-9_]{4,16}$/.test(username.value.trim().toLowerCase())
})

const canProceed = computed(() => {
  return isValidName.value && isValidUsername.value && !usernameError.value && !isSubmitting.value
})

function onAvatarClick() {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (file.size > 8 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 8 МБ.')
    return
  }

  emit('open-cropper', file)
}

// Method called externally by cropper when cropped
function setCroppedAvatar(blob: Blob) {
  avatarBlob.value = blob
  if (avatarPreview.value) {
    URL.revokeObjectURL(avatarPreview.value)
  }
  avatarPreview.value = URL.createObjectURL(blob)
}

defineExpose({ setCroppedAvatar })

async function checkUsername() {
  const un = username.value.trim().toLowerCase()
  if (!un) {
    usernameError.value = ''
    return
  }
  if (!isValidUsername.value) {
    usernameError.value = 'Латиница, цифры и _, от 4 до 16 символов'
    return
  }

  isCheckingUsername.value = true
  usernameError.value = ''

  try {
    const { data } = await supabase.from('profiles').select('id').eq('username', un).maybeSingle()
    if (data && data.id !== authStore.user?.id) {
      usernameError.value = 'Этот юзернейм уже занят'
    }
  } catch (err) {
    console.warn('Error checking username:', err)
  } finally {
    isCheckingUsername.value = false
  }
}

async function handleNext() {
  if (!canProceed.value) return
  isSubmitting.value = true
  generalError.value = ''

  try {
    await authStore.saveProfileSetup(name.value.trim(), username.value.trim(), avatarBlob.value)
  } catch (err: any) {
    generalError.value = friendlyAuthError(err) || 'Ошибка сохранения профиля'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="screen active visible auth-screen">
    <h1>Создание профиля</h1>
    <div class="subtitle">Как вас будут видеть другие пользователи Quietly</div>

    <div class="avatar-wrap">
      <div class="avatar-circle" @click="onAvatarClick">
        <img v-if="avatarPreview" :src="avatarPreview" alt="Avatar" />
        <SolarIcon v-else name="camera-add-linear" :size="38" color="#8e8e96" />
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        @change="onFileSelected"
      />
      <div class="avatar-hint">Нажмите, чтобы загрузить аватар</div>
    </div>

    <div class="field">
      <label class="field-label">Имя</label>
      <input
        v-model="name"
        type="text"
        placeholder="Ваше имя"
        maxlength="24"
        autocomplete="name"
      />
    </div>

    <div class="field" :class="{ 'has-error': !!usernameError }">
      <label class="field-label">Юзернейм</label>
      <div class="input-wrap">
        <span class="prefix">@</span>
        <input
          v-model="username"
          type="text"
          class="with-prefix"
          placeholder="username"
          maxlength="16"
          autocomplete="off"
          spellcheck="false"
          @input="username = username.toLowerCase().replace(/[^a-z0-9_]/g, '')"
          @blur="checkUsername"
        />
      </div>
      <div v-if="usernameError" class="error-text">{{ usernameError }}</div>
    </div>

    <div v-if="generalError" class="error-text text-center" style="margin-top: 12px;">{{ generalError }}</div>

    <div class="bottom-spacer"></div>

    <button
      type="button"
      class="btn-next"
      :class="{ active: canProceed }"
      :disabled="!canProceed"
      @click="handleNext"
    >
      {{ isSubmitting ? 'Сохранение...' : 'Продолжить' }}
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

.field-label {
  display: block;
  font-size: var(--text-14);
  font-weight: 500;
  color: var(--muted);
  margin-bottom: var(--space-1-5);
  margin-left: var(--space-3);
}
</style>
