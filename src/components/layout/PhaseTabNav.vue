<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { useAssessmentStore } from '@/stores/assessment'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()

const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()
const assessmentStore = useAssessmentStore()
const authStore = useAuthStore()

const tabs = computed(() => [
  {
    id: 0,
    label: '总览',
    desc: '世界熔炉工作台',
    route: '/',
    completion: 0,
    active: route.path === '/'
  },
  {
    id: 1,
    label: '阶段一',
    desc: '世界框架与核心叙事',
    route: '/phase1/realm-structure',
    completion: worldStore.completionPercentage,
    active: route.path.startsWith('/phase1')
  },
  {
    id: 2,
    label: '阶段二',
    desc: '九大陆叙事设计',
    route: '/phase2',
    completion: continentsStore.overallCompletion,
    active: route.path.startsWith('/phase2')
  },
  {
    id: 3,
    label: '阶段三',
    desc: '前三大陆落地',
    route: '/phase3/mu',
    completion: landingStore.overallCompletion,
    active: route.path.startsWith('/phase3')
  },
  {
    id: 4,
    label: '素材库',
    desc: '图片资源',
    route: '/gallery',
    completion: 0,
    active: route.path.startsWith('/gallery')
  },
  {
    id: 5,
    label: '评测',
    desc: '世界观质量评估',
    route: '/assessment/start',
    completion: 0,
    active: route.path.startsWith('/assessment'),
    requiresAdmin: true
  },
  {
    id: 6,
    label: '世界观预览',
    desc: '可视化HTML报告',
    route: '/preview',
    completion: 0,
    active: route.path.startsWith('/preview')
  },
  {
    id: 7,
    label: '甲方意见',
    desc: '意见与定稿',
    route: '/opinions',
    completion: 0,
    active: route.path.startsWith('/opinions')
  }
])

function navigate(tab: typeof tabs.value[0]) {
  router.push(tab.route)
}
</script>

<template>
  <nav class="phase-tabs">
    <button
      v-for="tab in tabs.filter(t => !t.requiresAdmin || authStore.isAdmin)"
      :key="tab.id"
      class="phase-tab"
      :class="{ active: tab.active }"
      @click="navigate(tab)"
    >
      <span class="tab-label">{{ tab.label }}</span>
      <span class="tab-desc">{{ tab.desc }}</span>
      <span v-if="tab.completion > 0" class="tab-progress">{{ tab.completion }}%</span>
    </button>
  </nav>
</template>

<style scoped>
.phase-tabs {
  height: var(--tab-height);
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 6px 18px 0;
  background:
    linear-gradient(180deg, rgba(21, 19, 17, 0.9) 0%, rgba(9, 9, 8, 0.98) 100%);
  border-bottom: 1px solid rgba(236, 204, 142, 0.18);
  flex-shrink: 0;
  position: relative;
  z-index: 9;
  box-shadow: inset 0 1px 0 rgba(212, 168, 83, 0.08);
  overflow-x: auto;
  overflow-y: hidden;
}

.phase-tabs::before {
  content: '';
  position: absolute;
  bottom: -1px; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 168, 83, 0.35), transparent);
}

.phase-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: max-content;
  height: calc(var(--tab-height) - 8px);
  padding: 0 16px;
  border: 1px solid transparent;
  background: rgba(255, 240, 200, 0.02);
  cursor: pointer;
  position: relative;
  font-family: inherit;
  color: var(--color-text-secondary);
  transition: color 240ms ease, background 240ms ease, border-color 240ms ease, transform 240ms ease;
  letter-spacing: 0.02em;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
}

.phase-tab::before {
  content: '';
  position: absolute;
  top: 8px; bottom: 8px;
  right: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(212, 168, 83, 0.22), transparent);
}
.phase-tab:last-child::before { display: none; }

.phase-tab:hover {
  color: var(--color-text);
  background: linear-gradient(180deg, rgba(212, 168, 83, 0.1), rgba(212, 168, 83, 0.02));
  border-color: rgba(236, 204, 142, 0.18);
  transform: translateY(-1px);
}

.phase-tab.active {
  color: var(--epic-halo);
  background:
    linear-gradient(180deg, rgba(248, 207, 122, 0.18) 0%, rgba(138, 90, 42, 0.08) 100%);
  border-color: rgba(248, 207, 122, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.12), 0 0 18px -10px rgba(248, 207, 122, 0.8);
}

/* 激活 Tab 底部烛火光 */
.phase-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--epic-candle) 20%, var(--epic-halo) 50%, var(--epic-candle) 80%, transparent);
  box-shadow:
    0 0 10px var(--color-glow-gold),
    0 0 20px rgba(212, 168, 83, 0.3);
  animation: phase-candle-flicker 3.2s ease-in-out infinite;
}

@keyframes phase-candle-flicker {
  0%, 100% { opacity: 1; transform: scaleX(1); }
  42% { opacity: 0.75; transform: scaleX(0.95); }
  58% { opacity: 1; transform: scaleX(1.02); }
}

.tab-label {
  font-size: 13.5px;
  font-weight: 600;
  font-family: var(--font-display-epic);
  letter-spacing: 0.12em;
}

.tab-desc {
  font-size: 11.5px;
  opacity: 0.6;
  letter-spacing: 0.02em;
}

.tab-progress {
  font-size: 10.5px;
  padding: 1.5px 8px;
  background: linear-gradient(135deg, rgba(212, 168, 83, 0.25), rgba(212, 168, 83, 0.08));
  color: var(--color-accent-gold);
  border: 1px solid rgba(212, 168, 83, 0.35);
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow: inset 0 1px 0 rgba(232, 200, 122, 0.2);
  font-family: 'JetBrains Mono', monospace;
}
</style>
