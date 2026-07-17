<script setup lang="ts">
import LandingWorkbench from './LandingWorkbench.vue'

defineProps<{ continentId?: string }>()
</script>

<template>
  <LandingWorkbench :continent-id="continentId" />
</template>
