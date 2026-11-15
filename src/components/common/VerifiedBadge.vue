<script setup lang="ts">
import type { UserProfile } from '../../types'
import SolarIcon from './SolarIcon.vue'
defineProps<{ profile?: UserProfile | null }>()
</script>

<template>
  <SolarIcon v-if="profile?.verified === true || profile?.badge === 'verified' || profile?.badges?.includes('verified')" class="verified-badge" name="verified-check-bold" :size="17" aria-label="Подтверждённый аккаунт" title="Подтверждённый аккаунт" />
</template>

<style scoped>
.verified-badge { display: inline-block; flex: none; vertical-align: middle; margin-left: 4px; color: #0a84ff; }
</style>
