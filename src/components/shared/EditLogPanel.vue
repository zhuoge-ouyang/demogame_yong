<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NDrawer, NDrawerContent, NButton, NTimeline, NTimelineItem, NTag, NCollapse, NCollapseItem, NSpin } from 'naive-ui'
import { useEditLogsStore } from '@/stores/edit-logs'
import { computeDiff } from '@/services/text-diff'

const editLogsStore = useEditLogsStore()
const showDrawer = ref(false)

function open() {
  showDrawer.value = true
  editLogsStore.fetchLogs(1)
}

function close() {
  showDrawer.value = false
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function truncate(text: string, maxLen = 100): string {
  if (!text) return '(空)'
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

// 生成 diff HTML
function diffHtml(oldText: string, newText: string): string {
  const segments = computeDiff(oldText, newText)
  return segments.map(seg => {
    const escaped = seg.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    if (seg.type === 'insert') return `<span class="diff-insert">${escaped}</span>`
    if (seg.type === 'delete') return `<span class="diff-delete">${escaped}</span>`
    return escaped
  }).join('')
}

defineExpose({ open })
</script>

<template>
  <!-- 浮动按钮 -->
  <div class="log-fab" @click="open">
    <NButton circle size="large" type="warning" style="width:48px;height:48px;">
      📋
    </NButton>
  </div>

  <!-- 抽屉面板 -->
  <NDrawer v-model:show="showDrawer" :width="480" placement="right">
    <NDrawerContent title="操作日志" closable>
      <NSpin :show="editLogsStore.loading">
        <div v-if="editLogsStore.logs.length === 0" style="color:rgba(255,255,255,0.4);text-align:center;padding:40px;">
          暂无操作日志
        </div>
        <div v-else class="log-list">
          <div v-for="log in editLogsStore.logs" :key="log.id" class="log-item">
            <div class="log-header">
              <NTag :type="log.username === 'yongge' ? 'warning' : 'info'" size="small">
                {{ log.username }}
              </NTag>
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            </div>
            <div class="log-field">{{ log.fieldLabel }}</div>
            <NCollapse>
              <NCollapseItem title="查看修改详情">
                <div class="log-diff" v-html="diffHtml(log.oldContent, log.newContent)" />
              </NCollapseItem>
            </NCollapse>
          </div>
          <div v-if="editLogsStore.logs.length < editLogsStore.total" style="text-align:center;padding:12px;">
            <NButton size="small" @click="editLogsStore.loadMore()">加载更多</NButton>
          </div>
        </div>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.log-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  cursor: pointer;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.log-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}
.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.log-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}
.log-field {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
}
.log-diff {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}
</style>

<style>
/* Diff 样式 - 全局 */
.diff-insert {
  background: rgba(58, 158, 92, 0.3);
  color: #4aae6c;
  padding: 0 2px;
  border-radius: 2px;
}
.diff-delete {
  background: rgba(212, 90, 58, 0.3);
  color: #e06a4a;
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
