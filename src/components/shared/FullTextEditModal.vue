<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NModal, NInput, NButton, NSpace, NTag } from 'naive-ui'
import { computeDiff } from '@/services/text-diff'
import { useMessage } from 'naive-ui'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  modelValue: string
  disabled?: boolean
  baseContent?: string
  lastEditBy?: string
}>(), {
  title: '内容',
  disabled: false,
  baseContent: '',
  lastEditBy: ''
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:modelValue', value: string): void
}>()

const message = useMessage()

const localValue = ref('')
const isDiffMode = ref(false)

// 弹窗打开时同步最新内容，默认进入编辑模式
watch(() => props.show, (val) => {
  if (val) {
    localValue.value = props.modelValue || ''
    isDiffMode.value = false
  }
})

// 是否存在可展示的 diff（baseContent 与当前内容不同）
const hasDiff = computed(() =>
  !!(props.lastEditBy && props.baseContent && props.baseContent !== localValue.value)
)

// diff segments
const diffSegments = computed(() => {
  if (!hasDiff.value) return []
  return computeDiff(props.baseContent!, localValue.value)
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

// 差异高亮 HTML
const highlightedHtml = computed(() => {
  if (!hasDiff.value) return escapeHtml(localValue.value)
  return diffSegments.value.map(seg => {
    const escaped = escapeHtml(seg.text)
    if (seg.type === 'insert') return `<span class="diff-insert">${escaped}</span>`
    if (seg.type === 'delete') return `<span class="diff-delete">${escaped}</span>`
    return escaped
  }).join('')
})

// 编辑者显示名称
const editorLabel = computed(() => {
  if (!props.lastEditBy) return ''
  return props.lastEditBy === 'yongge' ? '甲方编辑' : '开发者编辑'
})

function handleConfirm() {
  emit('update:modelValue', localValue.value)
  message.success('已保存', { duration: 1500 })
  // 不关闭弹窗，用户可继续编辑
}

function handleClose() {
  emit('update:show', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'Enter' && !props.disabled && !isDiffMode.value) {
    handleConfirm()
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="`查看 / 编辑：${title}`"
    style="width: 860px; max-width: 92vw;"
    :mask-closable="true"
    @update:show="(v) => { if (!v) handleClose() }"
  >
    <template #header-extra>
      <!-- 存在 diff 时才显示切换按钮 -->
      <NSpace v-if="hasDiff" :size="8" align="center">
        <NTag size="small" :type="lastEditBy === 'yongge' ? 'warning' : 'info'" :bordered="false">
          {{ editorLabel }}已修改
        </NTag>
        <NButton
          size="small"
          :type="isDiffMode ? 'warning' : 'default'"
          ghost
          @click="isDiffMode = !isDiffMode"
        >
          {{ isDiffMode ? '✏️ 返回编辑' : '🔍 查看差异' }}
        </NButton>
      </NSpace>
    </template>

    <!-- 差异对比模式 -->
    <div v-if="isDiffMode" class="diff-view-container">
      <div class="diff-view-hint">
        <span class="diff-legend diff-legend--insert">新增内容</span>
        <span class="diff-legend diff-legend--delete">删除内容</span>
        <span class="diff-legend diff-legend--note">对比基准：天达版本 / 历史快照</span>
      </div>
      <div class="diff-view-body" v-html="highlightedHtml" />
    </div>

    <!-- 编辑模式 -->
    <NInput
      v-else
      v-model:value="localValue"
      type="textarea"
      :placeholder="disabled ? `「${title}」的完整内容（只读）` : `在此查看或编辑「${title}」的完整内容...\n\nCtrl+Enter 可快速确认保存`"
      :autosize="{ minRows: 20 }"
      :maxlength="20000"
      show-count
      :disabled="disabled"
      :style="{ fontSize: '14px', lineHeight: '1.7' }"
      @keydown="handleKeydown"
    />

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">关闭</NButton>
        <NButton v-if="!disabled && !isDiffMode" type="primary" @click="handleConfirm">
          保存
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.diff-view-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-view-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  padding: 0 2px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-wrap: wrap;
}

.diff-legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.diff-legend::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.diff-legend--insert::before {
  background: rgba(232, 186, 58, 0.4);
}

.diff-legend--delete::before {
  background: rgba(255, 80, 80, 0.3);
}

.diff-legend--note::before {
  display: none;
}

.diff-view-body {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  padding: 12px 16px;
  min-height: 320px;
  max-height: 60vh;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.03);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  color: rgba(255, 255, 255, 0.82);
}
</style>
