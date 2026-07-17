<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton } from 'naive-ui'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SaveButton from '@/components/shared/SaveButton.vue'
import EpicBanner from '@/components/shared/EpicBanner.vue'
import { CONTINENT_MAP, LANDING_CONTINENT_IDS } from '@/constants/continents'
import { useLandingStore } from '@/stores/landing'
import { useAssessmentStore } from '@/stores/assessment'
import type { LandingContinentId } from '@/types/landing'

const landingStore = useLandingStore()

async function savePhase3() {
  await landingStore.saveNow()
}
const assessmentStore = useAssessmentStore()
const router = useRouter()

const assessmentFeedback = computed(() => assessmentStore.getPhaseFeedback(3))

function dismissFeedback() {
  assessmentStore.dismissPhaseFeedback(3)
}

function goToAssessment() {
  if (assessmentFeedback.value) {
    router.push(`/assessment/result/${assessmentFeedback.value.reportId}`)
  }
}

const sidebarItems = computed(() =>
  LANDING_CONTINENT_IDS.map(id => {
    const meta = CONTINENT_MAP[id]
    return {
      key: id,
      label: `${meta.name} · ${meta.element}`,
      route: `/phase3/${id}`,
      completed: landingStore.getContinentCompletion(id as LandingContinentId) === 100
    }
  })
)
</script>

<template>
  <div class="phase-layout">
    <AppSidebar :items="sidebarItems" />
    <main class="phase-content">
      <EpicBanner
        kicker="CHAPTER III · LANDING EPIC"
        title="前三大陆落地文案"
        subtitle="金、冰、火依序推进 · 三幕九区 · 区域短句与Boss叙事"
        image="/images/banners/phase3.png"
        seal-char="III"
        accent="blood"
        height="short"
      />
      <!-- 顶部操作栏 -->
      <div class="phase-header-actions">
        <SaveButton :save-handler="savePhase3" />
      </div>
      <!-- 评测反馈通知 -->
      <div v-if="assessmentFeedback && !assessmentFeedback.dismissed" class="assessment-feedback-banner">
        <NAlert 
          :type="assessmentFeedback.needsOptimization ? 'warning' : 'success'" 
          closable
          @close="dismissFeedback"
        >
          <template #header>
            评测结果：{{ assessmentFeedback.averageScore }} 分 ({{ assessmentFeedback.overallGrade }}级)
          </template>
          <div v-if="assessmentFeedback.needsOptimization">
            <p>以下维度需要优化：</p>
            <ul>
              <li v-for="dim in assessmentFeedback.weakDimensions" :key="dim.name">
                {{ dim.name }}：{{ dim.score }}/{{ dim.maxScore }}
              </li>
            </ul>
            <NButton size="small" type="warning" @click="goToAssessment">
              查看详细评测报告
            </NButton>
          </div>
          <div v-else>
            世界观质量评估良好，可继续推进设计工作。
          </div>
        </NAlert>
      </div>
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.phase-layout {
  display: flex;
  width: 100%;
  height: calc(100vh - var(--header-height) - var(--tab-height));
  overflow: hidden;
}

.phase-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.assessment-feedback-banner {
  padding: 16px 24px 0;
  margin-bottom: 16px;
}

.assessment-feedback-banner ul {
  margin: 4px 0;
  padding-left: 20px;
}

.assessment-feedback-banner li {
  margin: 2px 0;
}

.phase-header-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px 24px 0;
}

@media (max-width: 860px) {
  .phase-layout {
    flex-direction: column;
    height: auto;
    min-height: calc(100vh - var(--header-height) - var(--tab-height));
    overflow: visible;
  }

  .phase-content {
    overflow: visible;
  }

  :deep(.app-sidebar) {
    width: 100%;
    padding: 8px;
    border-right: 0;
    border-bottom: 1px solid rgba(236, 204, 142, 0.13);
    overflow-x: auto;
    overflow-y: hidden;
    box-sizing: border-box;
  }

  :deep(.sidebar-nav) {
    width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  :deep(.sidebar-nav::before) {
    display: none;
  }

  :deep(.sidebar-item) {
    width: 100%;
    min-width: 0;
  }

  .phase-header-actions {
    padding: 10px 16px 0;
  }
}

@media (max-width: 560px) {
  :deep(.sidebar-item) {
    justify-content: center;
    gap: 4px;
    padding-inline: 6px;
  }

  :deep(.item-numeral),
  :deep(.item-indicator) {
    display: none;
  }

  :deep(.item-label) {
    flex: 0 1 auto;
    text-align: center;
  }
}
</style>
