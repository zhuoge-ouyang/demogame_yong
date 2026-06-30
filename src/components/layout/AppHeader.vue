<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSpace, NTooltip, NPopconfirm, useMessage } from 'naive-ui'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import AIConfigModal from '@/components/shared/AIConfigModal.vue'
import ExportImportModal from '@/components/shared/ExportImportModal.vue'
import SnapshotPanel from '@/components/shared/SnapshotPanel.vue'
import { useLocalAccess } from '@/composables/useLocalAccess'
import { useDataSync } from '@/composables/useDataSync'

const appStore = useAppStore()
const authStore = useAuthStore()
const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()
const router = useRouter()
const { isLocalUser } = useLocalAccess()
const dataSync = useDataSync()
const showAIConfig = ref(false)
const showExportImport = ref(false)
const exportImportMode = ref<'export' | 'import'>('export')
const message = useMessage()
const saving = ref(false)
const snapshotPanelRef = ref()

const lastSaved = computed(() => appStore.lastSavedAt)

function handleExport() {
  exportImportMode.value = 'export'
  showExportImport.value = true
}

function handleImport() {
  exportImportMode.value = 'import'
  showExportImport.value = true
}

function goHome() {
  router.push('/')
}

function handleClearAll() {
  worldStore.resetAll()
  continentsStore.resetAll()
  landingStore.resetAll()
  message.success('数据已清空')
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

/** 手动拉取服务器最新数据 */
async function handleSyncNow() {
  // 有未保存的本地修改时先提示
  const hasDirty =
    localStorage.getItem('sjg_world_dirty') ||
    localStorage.getItem('sjg_continents_dirty') ||
    localStorage.getItem('sjg_landing_dirty')
  if (hasDirty) {
    message.warning('您有未保存的修改，请先保存再拉取，避免覆盖本地内容')
    return
  }
  const ok = await dataSync.syncNow()
  if (ok) {
    message.success('内容已同步到最新')
  } else {
    // 检测是否是会话过期导致的失败
    try {
      const authRes = await fetch('/api/auth/check', { credentials: 'same-origin' })
      const authData = await authRes.json()
      if (!authData.authenticated) {
        message.error('登录会话已过期，请重新登录后再操作')
        await handleLogout()
        return
      }
    } catch (e) {
      console.warn('[AppHeader] 无法检查登录状态:', e)
    }
    message.error('拉取失败：服务器未返回数据，请刷新页面重试')
  }
}

/** 手动保存所有数据 */
async function handleSaveAll() {
  if (saving.value) return
  saving.value = true
  try {
    await Promise.all([
      worldStore.saveNow(),
      continentsStore.saveNow(),
      landingStore.saveNow()
    ])
    message.success('保存成功，数据已同步到服务器')
  } catch (e) {
    message.error('保存失败，请重试')
    console.error('[AppHeader] 保存失败:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <button class="brand-button" @click="goHome" aria-label="返回世界熔炉总览">
        <!-- 盾徽章 -->
        <span class="app-crest" aria-hidden="true">
        <svg viewBox="0 0 48 48" class="crest-svg">
          <defs>
            <linearGradient id="crestGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f0e3c3" />
              <stop offset="50%" stop-color="#d4a853" />
              <stop offset="100%" stop-color="#8a5a2a" />
            </linearGradient>
          </defs>
          <path d="M24 3 L42 11 L42 26 Q42 38 24 45 Q6 38 6 26 L6 11 Z"
                fill="url(#crestGold)"
                stroke="#e8c87a" stroke-width="0.8" />
          <path d="M24 12 L26 22 L36 24 L26 26 L24 36 L22 26 L12 24 L22 22 Z"
                fill="#1a1206" opacity="0.75" />
          <circle cx="24" cy="24" r="2" fill="#f8d97a" />
        </svg>
        </span>
        <span class="title-block">
          <h1 class="app-title">World Forge</h1>
          <span class="app-subtitle">西幻塔防 · 神话生成控制台</span>
        </span>
      </button>
      <span v-if="lastSaved" class="save-status">已缓存 {{ lastSaved }}</span>
    </div>
    <div class="header-right">
      <NSpace :size="8" align="center" wrap>
        <!-- 拉取最新数据按鈕 -->
        <NButton
          size="small"
          ghost
          :loading="dataSync.syncing.value"
          @click="handleSyncNow"
        >
          {{ dataSync.syncing.value ? '同步中' : '同步' }}
        </NButton>
        <!-- 全局保存按鈕 -->
        <NButton 
          type="primary" 
          size="small"
          :loading="saving" 
          @click="handleSaveAll"
        >
          {{ saving ? '保存中' : '保存' }}
        </NButton>
        <NButton size="small" ghost @click="snapshotPanelRef?.open()">快照</NButton>
        <span class="header-divider"></span>
        <NTooltip>
          <template #trigger>
            <NButton size="small" quaternary @click="handleExport">导出</NButton>
          </template>
          导出数据为JSON文件
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton size="small" quaternary @click="handleImport">导入</NButton>
          </template>
          从 JSON 文件导入数据
        </NTooltip>
        <NPopconfirm @positive-click="handleClearAll" positive-text="确定清空" negative-text="取消">
          <template #trigger>
            <NTooltip>
              <template #trigger>
                <NButton size="small" quaternary style="color: var(--color-danger, #e74c3c)">清空</NButton>
              </template>
              一键清空所有世界观数据
            </NTooltip>
          </template>
          确定要清空所有世界观数据吗？此操作不可恢复。
        </NPopconfirm>
        <NButton v-if="isLocalUser" size="small" type="primary" ghost @click="showAIConfig = true">
          AI
        </NButton>
        <NTooltip v-if="authStore.isAuthenticated">
          <template #trigger>
            <NButton size="small" quaternary @click="handleLogout">
              登出
            </NButton>
          </template>
          {{ authStore.username }} 点击退出登录
        </NTooltip>
      </NSpace>
    </div>
  </header>
  <AIConfigModal v-if="isLocalUser" v-model:show="showAIConfig" />
  <ExportImportModal v-model:show="showExportImport" :mode="exportImportMode" />
  <SnapshotPanel ref="snapshotPanelRef" />
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 18px;
  background:
    linear-gradient(180deg, rgba(18, 17, 16, 0.96) 0%, rgba(8, 8, 7, 0.98) 100%),
    radial-gradient(circle at 20% 0%, rgba(248, 207, 122, 0.12), transparent 38%);
  border-bottom: 1px solid rgba(236, 204, 142, 0.18);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.6),
    0 16px 42px -28px rgba(0, 0, 0, 0.88);
}

/* 顶部金线浮雕 */
.app-header::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(248, 207, 122, 0.35) 20%, rgba(255, 241, 200, 0.7) 50%, rgba(248, 207, 122, 0.35) 80%, transparent);
  box-shadow: 0 1px 10px rgba(212, 168, 83, 0.24);
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-accent-gold-dark), transparent);
  opacity: 0.55;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

/* 盾徽章 */
.app-crest {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  filter: drop-shadow(0 2px 6px rgba(212, 168, 83, 0.4));
  transition: transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.app-crest:hover { transform: scale(1.08) rotate(-3deg); }
.crest-svg { width: 100%; height: 100%; }

.title-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  gap: 2px;
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--epic-halo);
  font-family: var(--font-display-epic);
  letter-spacing: 0.16em;
  margin: 0;
  text-shadow: 0 0 12px rgba(212, 168, 83, 0.3);
  text-transform: uppercase;
}

.app-subtitle {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-family: var(--font-display-epic);
  opacity: 0.75;
}

.save-status {
  font-size: 11px;
  color: rgba(232, 218, 190, 0.66);
  opacity: 0.75;
  padding: 3px 10px;
  border: 1px solid rgba(236, 204, 142, 0.16);
  background: rgba(255, 240, 200, 0.035);
  font-family: var(--font-serif-classic);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-divider {
  display: inline-block;
  width: 1px;
  height: 22px;
  background: linear-gradient(180deg, transparent, rgba(236, 204, 142, 0.28), transparent);
  margin: 0 2px;
}

/* 按钮微调：为额外的顶栏金色光感剩点甜点 */
.header-right :deep(.n-button--primary-type) {
  box-shadow: 0 0 0 1px rgba(232, 200, 122, 0.4), 0 4px 12px -2px rgba(212, 168, 83, 0.4);
}

.header-right :deep(.n-button) {
  --n-border-radius: 2px !important;
  letter-spacing: 0.06em;
}

@media (max-width: 980px) {
  .app-header {
    height: auto;
    min-height: var(--header-height);
    padding: 10px 12px;
    align-items: flex-start;
    flex-direction: column;
  }

  .header-right {
    width: 100%;
  }

  .save-status {
    display: none;
  }
}
</style>
