<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const route = useRoute()
const router = useRouter()

const sidebarItems = computed(() => [
  {
    key: 'start',
    label: '开始评测',
    route: '/assessment/start',
    completed: false
  },
  {
    key: 'history',
    label: '评测历史',
    route: '/assessment/history',
    completed: false
  }
])

// 隐藏侧边栏在进度和结果页面
const showSidebar = computed(() => {
  return route.path === '/assessment/start' || route.path === '/assessment/history'
})
</script>

<template>
  <div class="phase-layout">
    <AppSidebar v-if="showSidebar" :items="sidebarItems" />
    <main class="phase-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.phase-layout {
  display: flex;
  height: calc(100vh - var(--header-height) - var(--tab-height));
  overflow: hidden;
}

.phase-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
