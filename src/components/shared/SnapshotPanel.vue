<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NDrawer, NDrawerContent, NButton, NInput, NPopconfirm, NTag, NSpace, NSpin, useMessage, useDialog } from 'naive-ui'

interface Snapshot {
  id: string
  name: string
  createdAt: number
  createdBy: string
}

const message = useMessage()
const dialog = useDialog()
const showDrawer = ref(false)
const snapshots = ref<Snapshot[]>([])
const loading = ref(false)
const creating = ref(false)
const snapshotName = ref('')

async function fetchSnapshots() {
  loading.value = true
  try {
    const res = await fetch('/api/snapshots', { credentials: 'same-origin' })
    if (res.ok) snapshots.value = await res.json()
  } catch (e) {
    console.warn('获取快照失败:', e)
  } finally {
    loading.value = false
  }
}

async function createSnapshot() {
  creating.value = true
  try {
    const res = await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: snapshotName.value || undefined })
    })
    if (res.ok) {
      message.success('快照创建成功')
      snapshotName.value = ''
      await fetchSnapshots()
    } else {
      const data = await res.json().catch(() => ({}))
      message.error(data.error || '创建快照失败')
    }
  } catch (e) {
    message.error('创建快照失败')
  } finally {
    creating.value = false
  }
}

async function restoreSnapshot(snap: Snapshot) {
  dialog.warning({
    title: '确认恢复',
    content: `确定要恢复到快照「${snap.name}」吗？当前数据将被覆盖。`,
    positiveText: '确认恢复',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res = await fetch(`/api/snapshots/${snap.id}/restore`, {
          method: 'POST',
          credentials: 'same-origin'
        })
        if (res.ok) {
          message.success('恢复成功，正在刷新页面...')
          setTimeout(() => window.location.reload(), 1000)
        } else {
          const data = await res.json().catch(() => ({}))
          message.error(data.error || '恢复失败')
        }
      } catch (e) {
        message.error('恢复失败')
      }
    }
  })
}

async function deleteSnapshot(snap: Snapshot) {
  try {
    const res = await fetch(`/api/snapshots/${snap.id}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    })
    if (res.ok) {
      message.success('快照已删除')
      await fetchSnapshots()
    } else {
      const data = await res.json().catch(() => ({}))
      message.error(data.error || '删除失败')
    }
  } catch (e) {
    message.error('删除失败')
  }
}

function formatTime(ts: number): string {
  if (!ts) return '未知'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function open() {
  showDrawer.value = true
  fetchSnapshots()
}

defineExpose({ open })
</script>

<template>
  <NDrawer v-model:show="showDrawer" :width="420" placement="right">
    <NDrawerContent title="数据快照管理" closable>
      <!-- 创建快照 -->
      <div style="margin-bottom: 16px;">
        <NSpace vertical :size="8">
          <NInput v-model:value="snapshotName" placeholder="快照名称（可选）" size="small" />
          <NButton type="primary" :loading="creating" block @click="createSnapshot">
            📸 保存当前快照
          </NButton>
        </NSpace>
      </div>

      <!-- 快照列表 -->
      <NSpin :show="loading">
        <div v-if="snapshots.length === 0" style="color: rgba(255,255,255,0.4); text-align: center; padding: 40px;">
          暂无快照
        </div>
        <div v-else style="display: flex; flex-direction: column; gap: 10px;">
          <div v-for="snap in snapshots" :key="snap.id"
            style="border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; background: rgba(255,255,255,0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 600;">{{ snap.name }}</span>
              <NTag size="small" :type="snap.createdBy === 'yongge' ? 'warning' : 'info'">
                {{ snap.createdBy || '未知' }}
              </NTag>
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 8px;">
              {{ formatTime(snap.createdAt) }}
            </div>
            <NSpace :size="6">
              <NPopconfirm @positive-click="restoreSnapshot(snap)" positive-text="确定" negative-text="取消">
                <template #trigger>
                  <NButton size="tiny" type="success">恢复</NButton>
                </template>
                确定恢复到该快照吗？当前数据将被覆盖。
              </NPopconfirm>
              <NPopconfirm @positive-click="deleteSnapshot(snap)" positive-text="确定" negative-text="取消">
                <template #trigger>
                  <NButton size="tiny" type="error" quaternary>删除</NButton>
                </template>
                确定删除该快照吗？
              </NPopconfirm>
            </NSpace>
          </div>
        </div>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>
