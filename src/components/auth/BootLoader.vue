<script setup lang="ts">
const logo = `${import.meta.env.BASE_URL}quietly-icon.png`
</script>

<template>
  <div class="boot-loader">
    <div class="loader-logo">
      <img :src="logo" alt="Quietly" width="96" height="96" />
    </div>
  </div>
</template>

<style scoped>
.boot-loader {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #18181b;
  z-index: 9999;
}

.loader-logo img { display: block; width: 96px; height: 96px; object-fit: contain; }

.loader-logo {
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(0.94);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}
</style>
