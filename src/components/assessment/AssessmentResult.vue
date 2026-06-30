<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NCard, NButton, NTag, NSpace, NDataTable, NCollapse, NCollapseItem,
  NAlert, NSpin, NEmpty
} from 'naive-ui'
import { useAssessmentStore } from '@/stores/assessment'
import { ASSESSMENT_DIMENSIONS, getOverallGrade } from '@/constants/assessment'
import { runKimiAnalysis } from '@/services/assessment-evaluator'
import type { AssessmentReport, AssessmentDimensionId, OverallGrade } from '@/types/assessment'
import PromptOptimizeModal from './PromptOptimizeModal.vue'

const router = useRouter()
const route = useRoute()
const assessmentStore = useAssessmentStore()

const props = defineProps<{
  reportId?: string
}>()

// 当前报告
const report = computed<AssessmentReport | null>(() => {
  if (props.reportId) {
    return assessmentStore.reports.find(r => r.id === props.reportId) || null
  }
  return assessmentStore.currentReport
})

// Kimi分析状态
const isAnalyzing = ref(false)
const showOptimizeModal = ref(false)

// 等级颜色
const gradeColors: Record<OverallGrade, string> = {
  'S': '#C8A951',
  'A': 'var(--color-success)',
  'B': 'var(--color-primary)',
  'C': 'var(--color-warning)',
  'D': 'var(--color-error)'
}

// 综合等级
const overallGrade = computed(() => {
  if (!report.value) return 'D'
  return getOverallGrade(report.value.averageScore)
})

// 最高分和最低分模型
const scoreStats = computed(() => {
  if (!report.value || report.value.modelResults.length === 0) {
    return { highest: null, lowest: null }
  }
  const sorted = [...report.value.modelResults].sort((a, b) => b.totalScore - a.totalScore)
  return {
    highest: sorted[0],
    lowest: sorted[sorted.length - 1]
  }
})

// 表格列定义 - 使用render函数
const tableColumns = computed(() => {
  const cols: any[] = [
    {
      title: '评测维度',
      key: 'dimension',
      width: 180
    }
  ]

  // 动态添加模型列
  const providers = ['qwen', 'doubao', 'minimax'] as const
  for (const provider of providers) {
    const hasResult = report.value?.modelResults.some(r => r.provider === provider)
    if (hasResult) {
      cols.push({
        title: provider === 'qwen' ? 'Qwen评分' : provider === 'doubao' ? '豆包评分' : 'Minimax评分',
        key: provider,
        width: 100,
        align: 'center' as const,
        render(row: any) {
          const value = row[provider]
          const isLow = typeof value === 'object' && value?.isLow
          return h('span', {
            style: { color: isLow ? 'var(--color-error)' : 'inherit' }
          }, typeof value === 'object' ? value.text : value)
        }
      })
    }
  }

  cols.push({
    title: '满分',
    key: 'maxScore',
    width: 80,
    align: 'center' as const
  })

  return cols
})

// 表格数据
const tableData = computed(() => {
  return ASSESSMENT_DIMENSIONS.map(dim => {
    const row: Record<string, any> = {
      dimension: dim.displayName,
      maxScore: dim.weight
    }

    for (const result of report.value?.modelResults || []) {
      const dimScore = result.dimensions.find(d => d.dimension === dim.id)
      if (dimScore) {
        const isLow = dimScore.score < dim.weight * 0.8
        row[result.provider] = isLow
          ? { text: `${dimScore.score}`, isLow: true }
          : `${dimScore.score}`
      } else {
        row[result.provider] = '-'
      }
    }

    return row
  })
})

// 获取维度详情
function getDimensionDetails(dimId: AssessmentDimensionId) {
  if (!report.value) return []
  return report.value.modelResults.map(result => {
    const dim = result.dimensions.find(d => d.dimension === dimId)
    return {
      provider: result.provider,
      modelName: result.modelName,
      score: dim?.score || 0,
      maxScore: dim?.maxScore || 0,
      grade: dim?.grade || 'fail',
      reasoning: dim?.reasoning || '',
      keyIssues: dim?.keyIssues || [],
      suggestions: dim?.suggestions || []
    }
  })
}

// 开始Kimi分析
async function startKimiAnalysis() {
  if (!report.value) return
  isAnalyzing.value = true

  try {
    // 获取当前阶段的提示词（简化实现）
    const currentPrompts: Record<string, string> = {}

    const analysis = await runKimiAnalysis(
      assessmentStore.kimiConfig,
      report.value.modelResults,
      currentPrompts,
      report.value.phase
    )

    assessmentStore.updateReport(report.value.id, { kimiAnalysis: analysis })
    assessmentStore.setOptimizedPrompts(analysis.optimizedPrompts)
  } catch (e: any) {
    console.error('Kimi分析失败:', e)
  } finally {
    isAnalyzing.value = false
  }
}

// 导出JSON
function exportJSON() {
  if (!report.value) return
  const data = JSON.stringify(report.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `assessment-report-${report.value.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 重新评测
function reAssess() {
  router.push('/assessment/start')
}

// 返回
function goBack() {
  router.push('/assessment/history')
}
</script>

<template>
  <div v-if="report" class="content-section">
    <h2>评测结果</h2>
    <p class="section-desc">
      Phase {{ report.phase }} 世界观质量评测报告
    </p>

    <!-- 汇总卡片 -->
    <NCard style="margin-bottom: 20px;">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">平均分</div>
          <div class="summary-value">{{ report.averageScore }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">综合等级</div>
          <div
            class="summary-grade"
            :style="{ color: gradeColors[overallGrade] }"
          >
            {{ overallGrade }}
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">评测模型</div>
          <div class="summary-value" style="font-size: 18px;">
            {{ report.modelResults.length }}
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">阶段完成度</div>
          <div class="summary-value" style="font-size: 18px;">
            {{ report.phaseCompletion }}%
          </div>
        </div>
      </div>

      <!-- 最高最低分 -->
      <div v-if="scoreStats.highest && scoreStats.lowest" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border);">
        <NSpace>
          <span style="font-size: 13px; color: var(--color-text-secondary);">
            最高分: <strong style="color: var(--color-success);">{{ scoreStats.highest.modelName }} ({{ scoreStats.highest.totalScore }}分)</strong>
          </span>
          <span style="font-size: 13px; color: var(--color-text-secondary);">
            最低分: <strong style="color: var(--color-error);">{{ scoreStats.lowest.modelName }} ({{ scoreStats.lowest.totalScore }}分)</strong>
          </span>
        </NSpace>
      </div>

      <!-- 优化提示 -->
      <NAlert
        v-if="report.needsOptimization"
        type="warning"
        style="margin-top: 20px;"
      >
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>评测结果未达标，建议进行提示词优化</span>
          <NButton
            v-if="assessmentStore.kimiConfig.apiKey && !report.kimiAnalysis"
            type="warning"
            size="small"
            :loading="isAnalyzing"
            @click="startKimiAnalysis"
          >
            开始优化分析
          </NButton>
        </div>
      </NAlert>
    </NCard>

    <!-- 对比表格 -->
    <NCard title="三模型对比" style="margin-bottom: 20px;">
      <NDataTable
        :columns="tableColumns"
        :data="tableData"
        :bordered="true"
        :single-line="false"
        size="small"
      />
    </NCard>

    <!-- 维度详情 -->
    <NCard title="维度详情" style="margin-bottom: 20px;">
      <NCollapse>
        <NCollapseItem
          v-for="dim in ASSESSMENT_DIMENSIONS"
          :key="dim.id"
          :title="dim.displayName"
        >
          <div
            v-for="detail in getDimensionDetails(dim.id)"
            :key="detail.provider"
            style="margin-bottom: 16px; padding: 12px; background: var(--color-bg-secondary); border-radius: var(--radius-md);"
          >
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <strong>{{ detail.modelName }}</strong>
              <NTag
                :type="detail.score >= detail.maxScore * 0.8 ? 'success' : detail.score >= detail.maxScore * 0.6 ? 'warning' : 'error'"
                size="small"
              >
                {{ detail.score }}/{{ detail.maxScore }}
              </NTag>
            </div>
            <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px;">
              <strong>评分理由：</strong>{{ detail.reasoning }}
            </div>
            <div v-if="detail.keyIssues.length > 0" style="font-size: 13px; margin-bottom: 8px;">
              <strong style="color: var(--color-error);">关键问题：</strong>
              <ul style="margin: 4px 0; padding-left: 20px;">
                <li v-for="(issue, i) in detail.keyIssues" :key="i">{{ issue }}</li>
              </ul>
            </div>
            <div v-if="detail.suggestions.length > 0" style="font-size: 13px;">
              <strong style="color: var(--color-success);">改进建议：</strong>
              <ul style="margin: 4px 0; padding-left: 20px;">
                <li v-for="(suggestion, i) in detail.suggestions" :key="i">{{ suggestion }}</li>
              </ul>
            </div>
          </div>
        </NCollapseItem>
      </NCollapse>
    </NCard>

    <!-- Kimi分析区域 -->
    <NCard
      v-if="report.needsOptimization && assessmentStore.kimiConfig.apiKey"
      title="Kimi深度分析"
      style="margin-bottom: 20px;"
    >
      <div v-if="!report.kimiAnalysis && !isAnalyzing">
        <NEmpty description="点击开始按钮进行深度分析">
          <template #extra>
            <NButton type="primary" @click="startKimiAnalysis">
              开始Kimi深度分析
            </NButton>
          </template>
        </NEmpty>
      </div>

      <div v-else-if="isAnalyzing">
        <div style="text-align: center; padding: 40px;">
          <NSpin size="large" />
          <p style="margin-top: 16px; color: var(--color-text-secondary);">
            Kimi正在分析评测结果...
          </p>
        </div>
      </div>

      <div v-else-if="report.kimiAnalysis">
        <div style="margin-bottom: 16px;">
          <h4 style="margin-bottom: 8px;">分析摘要</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6;">
            {{ report.kimiAnalysis.analysis }}
          </p>
        </div>

        <div v-if="report.kimiAnalysis.weakDimensions.length > 0" style="margin-bottom: 16px;">
          <h4 style="margin-bottom: 8px;">薄弱维度</h4>
          <NSpace>
            <NTag
              v-for="dimId in report.kimiAnalysis.weakDimensions"
              :key="dimId"
              type="warning"
              size="small"
            >
              {{ ASSESSMENT_DIMENSIONS.find(d => d.id === dimId)?.displayName || dimId }}
            </NTag>
          </NSpace>
        </div>

        <div v-if="report.kimiAnalysis.rootCauses.length > 0" style="margin-bottom: 16px;">
          <h4 style="margin-bottom: 8px;">根因分析</h4>
          <ul style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6;">
            <li v-for="(cause, i) in report.kimiAnalysis.rootCauses" :key="i">
              {{ cause }}
            </li>
          </ul>
        </div>

        <NButton type="primary" @click="showOptimizeModal = true">
          查看优化提示词
        </NButton>
      </div>
    </NCard>

    <!-- 底部操作栏 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--color-border);">
      <NButton @click="goBack">
        返回
      </NButton>
      <NSpace>
        <NButton @click="exportJSON">
          导出JSON
        </NButton>
        <NButton type="primary" @click="reAssess">
          重新评测
        </NButton>
      </NSpace>
    </div>

    <!-- 优化弹窗 -->
    <PromptOptimizeModal
      v-if="report.kimiAnalysis"
      v-model:show="showOptimizeModal"
      :report="report"
      @regenerate="reAssess"
    />
  </div>

  <div v-else class="content-section">
    <NEmpty description="未找到评测报告">
      <template #extra>
        <NButton @click="router.push('/assessment/history')">
          查看历史记录
        </NButton>
      </template>
    </NEmpty>
  </div>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.summary-item {
  text-align: center;
}

.summary-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.summary-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text);
}

.summary-grade {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}
</style>
