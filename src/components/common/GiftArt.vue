<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEconomyStore } from '../../stores/economy'
import SolarIcon from './SolarIcon.vue'

const props = defineProps<{ giftId?: string }>()
const economy = useEconomyStore()
const failed = ref(false)
const image = computed(() => economy.defaultGifts.find(gift => gift.id === props.giftId)?.image)
watch(image, () => { failed.value = false })
</script>

<template>
  <img v-if="image && !failed" class="gift-art" :src="image" alt="" draggable="false" @error="failed = true" />
  <span v-else class="gift-art gift-art-fallback" aria-hidden="true"><SolarIcon name="gift-linear" :size="32" /></span>
</template>

<style scoped>
.gift-art { display: block; width: 100%; height: 100%; object-fit: contain; }
.gift-art-fallback { display: grid; place-items: center; color: var(--muted); }
</style>
