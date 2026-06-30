<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NDataTable, NSelect, NEmpty, NButton, NTag, NSpace } from 'naive-ui'
import { useAssessmentStore } from '@/stores/assessment'
import { getOverallGrade } from '@/constants/assessment'
import type { OverallGrade } from '@/types/assessment'

const router = useRouter()
const assessmentStore = useAssessmentStore()

// 阶段筛选
const phaseFilter = ref<number | null>(null)
const phaseOptions = [
  { label: '全部阶段', value: null as number | null },
  { label: 'Phase 1', value: 1 as number | null },
  { label: 'Phase 2', value: 2 as number | null },
  { label: 'Phase 3', value: 3 as number | null }
]

// 等级颜色
const gradeColors: Record<OverallGrade, string> = {
  'S': '#C8A951',
  'A': 'var(--color-success)',
  'B': 'var(--color-primary)',
  'C': 'var(--color-warning)',
  'D': 'var(--color-error)'
}

// 筛选后的报告列表
const filteredReports = computed(() => {
  let list = [...assessmentStore.reports].sort((a, b) => b.createdAt - a.createdAt)
  if (phaseFilter.value !== null) {
    list = list.filter(r => r.phase === phaseFilter.value)
  }
  return list
})

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取状态标签类型
function getStatusType(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'optimizing':
      return 'warning'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}

// 获取状态文本
function getStatusText(status: string): string {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'optimizing':
      return '优化中'
    case 'failed':
      return '失败'
    case 'running':
      return '进行中'
    default:
      return status
  }
}

// 查看详情
function viewDetail(reportId: string) {
  router.push(`/assessment/result/${reportId}`)
}

// 开始新评测
function startNewAssessment() {
  router.push('/assessment/start')
}

// 表格列定义 - 使用render函数
const columns = computed(() => [
  {
    title: '日期',
    key: 'date',
    width: 160
  },
  {
    title: '阶段',
    key: 'phase',
    width: 100
  },
  {
    title: '平均分',
    key: 'averageScore',
    width: 100,
    align: 'center' as const
  },
  {
    title: '等级',
    key: 'grade',
    width: 80,
    align: 'center' as const,
    render(row: any) {
      return h('span', {
        style: {
          fontWeight: 700,
          fontSize: '16px',
          color: gradeColors[row.grade as OverallGrade]
        }
      }, row.grade)
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render(row: any) {
      const tags = [
        h(NTag, { type: getStatusType(row.status), size: 'small' }, () => getStatusText(row.status))
      ]
      if (row.needsOptimization) {
        tags.push(h(NTag, { type: 'warning', size: 'small' }, () => '需优化'))
      }
      return h(NSpace, { align: 'center' }, () => tags)
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    align: 'center' as const,
    render(row: any) {
      return h(NButton, { size: 'small', onClick: () => viewDetail(row.id) }, () => '查看详情')
    }
  }
])

// 表格数据
const tableData = computed(() => {
  return filteredReports.value.map(report => {
    const grade = getOverallGrade(report.averageScore)
    return {
      id: report.id,
      date: formatDate(report.createdAt),
      phase: `Phase ${report.phase}`,
      averageScore: report.averageScore,
      grade,
      status: report.status,
      needsOptimization: report.needsOptimization
    }
  })
})
</script>

<template>
  <div class="content-section">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h2>评测历史</h2>
        <p class="section-desc">
          查看所有历史评测记录
        </p>
      </div>
      <NButton type="primary" @click="startNewAssessment">
        开始新评测
      </NButton>
    </div>

    <!-- 筛选器 -->
    <div style="margin-bottom: 20px;">
      <NSelect
        v-model:value="phaseFilter"
        :options="phaseOptions as any"
        style="width: 160px;"
        placeholder="筛选阶段"
      />
    </div>

    <!-- 报告列表 -->
    <NCard v-if="filteredReports.length > 0">
      <NDataTable
        :columns="columns"
        :data="tableData"
        :bordered="true"
        :single-line="false"
        size="small"
      />
    </NCard>

    <!-- 空状态 -->
    <NCard v-else>
      <NEmpty description="暂无评测记录">
        <template #extra>
          <NButton type="primary" @click="startNewAssessment">
            开始第一次评测
          </NButton>
        </template>
      </NEmpty>
    </NCard>
  </div>
</template>
