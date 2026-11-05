<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: string | number
    color?: string
    variant?: 'linear' | 'bold' | 'outline' | 'broken'
    class?: string
  }>(),
  {
    size: 24,
    variant: 'linear',
    color: 'currentColor',
    class: '',
  }
)

const iconName = computed(() => {
  // If user passes full name like "solar:chat-round-dots-linear" or just "chat-round-dots"
  if (props.name.startsWith('solar:')) {
    return props.name
  }
  // If variant suffix is already present
  if (props.name.endsWith('-linear') || props.name.endsWith('-bold') || props.name.endsWith('-outline') || props.name.endsWith('-broken')) {
    return `solar:${props.name}`
  }
  return `solar:${props.name}-${props.variant}`
})
</script>

<template>
  <span class="solar-icon" :class="props.class" :style="{ color: props.color }">
    <Icon :icon="iconName" :width="props.size" :height="props.size" />
  </span>
</template>

<style scoped>
.solar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  vertical-align: middle;
}
</style>
