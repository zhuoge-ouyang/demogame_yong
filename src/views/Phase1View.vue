<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton } from 'naive-ui'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SaveButton from '@/components/shared/SaveButton.vue'
import EpicBanner from '@/components/shared/EpicBanner.vue'
import { PHASES } from '@/constants/phase-config'
import { useWorldStore } from '@/stores/world'
import { useAssessmentStore } from '@/stores/assessment'

const worldStore = useWorldStore()

async function savePhase1() {
  await worldStore.saveNow()
}
const assessmentStore = useAssessmentStore()
const router = useRouter()

const assessmentFeedback = computed(() => assessmentStore.getPhaseFeedback(1))

function dismissFeedback() {
  assessmentStore.dismissPhaseFeedback(1)
}

function goToAssessment() {
  if (assessmentFeedback.value) {
    router.push(`/assessment/result/${assessmentFeedback.value.reportId}`)
  }
}

const sidebarItems = computed(() => {
  const phase1 = PHASES[0]
  return phase1.modules.map(m => ({
    key: m.key,
    label: m.label,
    route: m.route,
    completed: false // 可以根据字段填写情况判断
  }))
})
</script>

<template>
  <div class="phase-layout">
    <AppSidebar :items="sidebarItems" />
    <main class="phase-content">
      <EpicBanner
        kicker="CHAPTER I · ORIGIN OF REALMS"
        title="世界框架与核心叙事"
        subtitle="三界的过去·现在·未来 — 一切的起点"
        image="/images/banners/phase1.png"
        seal-char="I"
        height="normal"
      />
      <!-- 顶部操作栏 -->
      <div class="phase-header-actions">
        <SaveButton :save-handler="savePhase1" />
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
