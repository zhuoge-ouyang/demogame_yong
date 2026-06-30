<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { NInput, NButton } from 'naive-ui'
import { computeDiff } from '@/services/text-diff'
import FullTextEditModal from './FullTextEditModal.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  baseContent?: string
  lastEditBy?: string
  placeholder?: string
  maxlength?: number
  disabled?: boolean
  showCount?: boolean
  autosize?: object | boolean
  showExpandButton?: boolean
  openInModal?: boolean
  previewLength?: number
  fieldLabel?: string
}>(), {
  baseContent: '',
  lastEditBy: '',
  placeholder: '',
  maxlength: 20000,
  disabled: false,
  showCount: true,
  autosize: () => ({ minRows: 3, maxRows: 30 }),
  showExpandButton: false,
  openInModal: false,
  previewLength: 300,
  fieldLabel: '内容'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input'): void
}>()

const isEditing = ref(false)
const inputRef = ref()
const showFullModal = ref(false)

// 是否使用弹窗预览（内容超过 previewLength，或父组件要求统一弹窗编辑）
const usesModalView = computed(() =>
  props.showExpandButton && (props.openInModal || (props.modelValue || '').length > props.previewLength)
)

// 截断后的摘要文本
const previewText = computed(() => {
  if (!usesModalView.value) return ''
  const text = props.modelValue || ''
  if (text.length <= props.previewLength) return text
  return text.slice(0, props.previewLength) + '...'
})

// 是否显示 diff 高亮
const showDiff = computed(() => {
  return props.lastEditBy === 'yongge' 
    && props.baseContent !== undefined 
    && props.baseContent !== ''
    && props.baseContent !== props.modelValue
})

// 计算 diff segments
const diffSegments = computed(() => {
  if (!showDiff.value) return []
  return computeDiff(props.baseContent, props.modelValue)
})

// 生成高亮 HTML
const highlightedHtml = computed(() => {
  if (!showDiff.value) return escapeHtml(props.modelValue || '')
  return diffSegments.value.map(seg => {
    const escaped = escapeHtml(seg.text)
    if (seg.type === 'insert') return `<span class="diff-insert">${escaped}</span>`
    if (seg.type === 'delete') return `<span class="diff-delete">${escaped}</span>`
    return escaped
  }).join('')
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

// 点击预览区：折叠状态打开模态框，否则进入内联编辑
function handleViewClick() {
  if (usesModalView.value) {
    showFullModal.value = true
  } else {
    startEditing()
  }
}

function startEditing() {
  if (props.disabled) return
  isEditing.value = true
  nextTick(() => {
    // 聚焦 NInput
    inputRef.value?.focus()
  })
}

function stopEditing() {
  isEditing.value = false
}

function onInput(val: string) {
  emit('update:modelValue', val)
  emit('input')
}

// 模态框保存：同步回父组件
function onModalSave(val: string) {
  emit('update:modelValue', val)
  emit('input')
}

// 字符计数
const charCount = computed(() => (props.modelValue || '').length)
</script>

<template>
  <div class="collab-text-field">
    <!-- 编辑模式（内联，仅在内容未折叠时使用） -->
    <NInput
      v-if="isEditing && !usesModalView"
      ref="inputRef"
      :value="modelValue"
      type="textarea"
      :placeholder="placeholder"
      :autosize="autosize"
      :maxlength="maxlength"
      :show-count="showCount"
      :disabled="disabled"
      @update:value="onInput"
      @blur="stopEditing"
    />

    <!-- 查看模式 -->
    <div
      v-else
      class="collab-view"
      :class="{
        'collab-view--disabled': disabled,
        'collab-view--has-diff': showDiff && !usesModalView,
        'collab-view--collapsed': usesModalView
      }"
      @click="handleViewClick"
    >
      <!-- 折叠摘要模式（内容 > previewLength） -->
      <template v-if="usesModalView">
        <div v-if="previewText" class="collab-view__content collab-view__preview-text">{{ previewText }}</div>
        <div v-else class="collab-view__placeholder">{{ placeholder }}</div>
        <NButton
          size="tiny"
          quaternary
          class="expand-btn"
          @click.stop="showFullModal = true"
        >
          查看全文
        </NButton>
        <div v-if="showCount" class="collab-view__count">{{ charCount }} / {{ maxlength }}</div>
      </template>

      <!-- 正常显示模式 -->
      <template v-else>
        <div v-if="modelValue" class="collab-view__content" v-html="highlightedHtml" />
        <div v-else class="collab-view__placeholder">{{ placeholder }}</div>
        <div v-if="showCount" class="collab-view__count">{{ charCount }} / {{ maxlength }}</div>
      </template>
    </div>

    <!-- 全文展示 / 编辑模态框 -->
    <FullTextEditModal
      v-model:show="showFullModal"
      :title="fieldLabel"
      :model-value="modelValue"
      :disabled="disabled"
      :base-content="baseContent"
      :last-edit-by="lastEditBy"
      @update:model-value="onModalSave"
    />
  </div>
</template>

<style scoped>
/* 折叠预览模式下的样式 */
.collab-view--collapsed {
  cursor: pointer;
  min-height: 64px;
}

.collab-view__preview-text {
  white-space: pre-wrap;
  word-break: break-all;
  color: #ead9b0;
  line-height: 1.75;
  padding-right: 80px; /* 为「查看全文」按钮留出空间 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.expand-btn {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 12px;
  color: #f0cd7a;
  border: 1px solid rgba(212, 168, 83, 0.5);
  border-radius: 3px;
  padding: 0 10px;
  height: 22px;
  line-height: 22px;
  background: linear-gradient(180deg, rgba(60, 40, 20, 0.9), rgba(30, 20, 12, 0.95));
  transition: all 0.18s;
  flex-shrink: 0;
  letter-spacing: 0.04em;
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.15), 0 2px 6px rgba(0, 0, 0, 0.5);
}

.expand-btn:hover {
  background: linear-gradient(180deg, rgba(90, 60, 30, 0.95), rgba(50, 32, 18, 0.98));
  color: #fff1c8;
  border-color: rgba(248, 207, 122, 0.75);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.25), 0 0 10px rgba(248, 207, 122, 0.3);
}

.collab-view {
  border: 1px solid rgba(212, 168, 83, 0.26);
  border-radius: 4px;
  padding: 10px 14px;
  min-height: 80px;
  cursor: text;
  /* 不透明暗底板 —— 彻底阻隔背景贮纹穿透 */
  background:
    linear-gradient(180deg, rgba(22, 17, 12, 0.94) 0%, rgba(14, 10, 7, 0.97) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.05),
    inset 0 -1px 0 rgba(0, 0, 0, 0.55),
    0 2px 8px -2px rgba(0, 0, 0, 0.5);
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  color: #ead9b0;
}
.collab-view:hover {
  border-color: rgba(248, 207, 122, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.1),
    0 0 0 1px rgba(212, 168, 83, 0.25),
    0 4px 14px -4px rgba(0, 0, 0, 0.6);
}
.collab-view--disabled {
  opacity: 0.72;
  cursor: not-allowed;
}
.collab-view--has-diff {
  border-left: 3px solid #e8943a;
}
.collab-view__placeholder {
  color: rgba(234, 217, 176, 0.4);
  font-style: italic;
}
.collab-view__count {
  position: absolute;
  bottom: 4px;
  right: 10px;
  font-size: 12px;
  color: rgba(212, 168, 83, 0.55);
  font-family: 'Cinzel', serif;
  letter-spacing: 0.05em;
}
</style>
