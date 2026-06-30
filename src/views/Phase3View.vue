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
      label: `${meta.icon} ${meta.name}`,
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
        title="前三大陆落地剧情"
        subtitle="火焰、冰霜与金辉的画卷 — 三位英雄与奇遇"
        image="/images/banners/phase3.png"
        seal-char="III"
        accent="blood"
        height="normal"
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
      <div class="phase3-locked">
        <div class="lock-icon">🔒</div>
        <div class="lock-title">阶段3内容暂不开放</div>
        <div class="lock-desc">前三大陆落地内容将在后续版本逐步开放</div>
      </div>
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

.phase3-locked {
  text-align: center;
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin: auto;
}

.lock-icon {
  font-size: 56px;
  opacity: 0.5;
}

.lock-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
}

.lock-desc {
  font-size: 14px;
  color: var(--color-text-tertiary);
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
</style>
