<script setup lang="ts">
import { computed } from 'vue'
import { splitEmoji } from '../../utils/emoji'
const props = defineProps<{ text: string }>()
const parts = computed(() => splitEmoji(props.text || ''))
</script>
<template><template v-for="(part, i) in parts" :key="i"><img v-if="part.url" class="apple-emoji" :src="part.url" :alt="part.text" draggable="false" /><template v-else>{{ part.text }}</template></template></template>
