<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NButton } from 'naive-ui'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SaveButton from '@/components/shared/SaveButton.vue'
import EpicBanner from '@/components/shared/EpicBanner.vue'
import { CONTINENTS } from '@/constants/continents'
import { useContinentsStore } from '@/stores/continents'
import { useAssessmentStore } from '@/stores/assessment'

const route = useRoute()
const router = useRouter()
const continentsStore = useContinentsStore()

async function savePhase2() {
  await continentsStore.saveNow()
}
const assessmentStore = useAssessmentStore()

const assessmentFeedback = computed(() => assessmentStore.getPhaseFeedback(2))

function dismissFeedback() {
  assessmentStore.dismissPhaseFeedback(2)
}

function goToAssessment() {
  if (assessmentFeedback.value) {
    router.push(`/assessment/result/${assessmentFeedback.value.reportId}`)
  }
}

const isDetail = computed(() => !!route.params.continentId || route.path === '/phase2/opening-battle')

const sidebarItems = computed(() => {
  const items: Array<{ key: string; label: string; route: string; completed: boolean }> = CONTINENTS.map(c => ({
    key: c.id,
    label: `${c.icon} ${c.name}`,
    route: `/phase2/${c.id}`,
    completed: continentsStore.getContinentCompletion(c.id) === 100
  }))
  // 在列表末尾添加"开场大战"条目
  items.push({
    key: 'opening-battle',
    label: '⚔️ 开场大战',
    route: '/phase2/opening-battle',
    completed: false
  })
  return items
})
</script>

<template>
  <div class="phase-layout">
    <AppSidebar :items="sidebarItems" />
    <main class="phase-content">
      <EpicBanner
        kicker="CHAPTER II · NINE CONTINENTS"
        title="九大陆叙事设计"
        subtitle="金·木·冰·火·土·风·雷·光·暗 — 九系元素的共战与共生"
        image="/images/banners/phase2.png"
        seal-char="II"
        accent="verdigris"
        height="normal"
      />
      <!-- 顶部操作栏 -->
      <div v-if="isDetail" class="phase-header-actions">
        <SaveButton :save-handler="savePhase2" />
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
