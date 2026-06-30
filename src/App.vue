<script setup lang="ts">
import { onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import AppHeader from './components/layout/AppHeader.vue'
import PhaseTabNav from './components/layout/PhaseTabNav.vue'
import EditLogPanel from './components/shared/EditLogPanel.vue'
import { useAuthStore } from './stores/auth'
import { useWorldStore } from './stores/world'
import { useContinentsStore } from './stores/continents'
import { useLandingStore } from './stores/landing'
import { useAIStore } from './stores/ai'
import { useAssessmentStore } from './stores/assessment'
import { useHistoryStore } from './stores/history'
import { useDataSync } from './composables/useDataSync'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Naive UI 魔幻暗色主题覆盖
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#d4a853',
    primaryColorHover: '#e8c87a',
    primaryColorPressed: '#b08a3e',
    primaryColorSuppl: '#d4a853',
    infoColor: '#4a90d9',
    infoColorHover: '#5da0e5',
    infoColorPressed: '#3a7cbf',
    successColor: '#3a9e5c',
    successColorHover: '#4aae6c',
    successColorPressed: '#2a8e4c',
    warningColor: '#d4a853',
    warningColorHover: '#e8c87a',
    warningColorPressed: '#b08a3e',
    errorColor: '#d45a3a',
    errorColorHover: '#e06a4a',
    errorColorPressed: '#c04a2a',
    bodyColor: '#090a0b',
    cardColor: '#15120f',
    modalColor: '#15120f',
    popoverColor: '#131516',
    tableColor: '#15120f',
    inputColor: '#0f1112',
    actionColor: '#0f1112',
    textColorBase: '#e8e0d0',
    textColor1: '#e8e0d0',
    textColor2: '#9b8e7e',
    textColor3: '#6b6058',
    borderColor: '#39332a',
    dividerColor: '#2a2824',
    hoverColor: '#201f1c',
    closeIconColor: '#9b8e7e',
    closeIconColorHover: '#e8e0d0',
    clearColor: '#9b8e7e',
    clearColorHover: '#e8e0d0',
    clearColorPressed: '#6b6058',
    placeholderColor: '#6b6058',
    placeholderColorDisabled: '#4a4040',
    iconColor: '#9b8e7e',
    iconColorHover: '#e8e0d0',
    borderRadius: '8px',
    borderRadiusSmall: '4px',
    fontSize: '15px',
    fontSizeMini: '13px',
    fontSizeTiny: '13px',
    fontSizeSmall: '14px',
    fontSizeMedium: '15px',
    fontSizeLarge: '16px',
    fontSizeHuge: '18px',
    lineHeight: '1.8',
  },
  Button: {
    textColorPrimary: '#0a0e1a',
    colorPrimary: '#d4a853',
    colorHoverPrimary: '#e8c87a',
    colorPressedPrimary: '#b08a3e',
    borderPrimary: '#d4a853',
    borderHoverPrimary: '#e8c87a',
    borderPressedPrimary: '#b08a3e',
    textColorGhostPrimary: '#d4a853',
    borderColorGhostPrimary: '#d4a853',
  },
  Card: {
    color: '#15120f',
    borderColor: '#39332a',
    titleTextColor: '#e8e0d0',
    actionColor: '#0f1112',
  },
  Input: {
    color: '#0f1112',
    colorFocus: '#0f1112',
    borderColor: '#39332a',
    borderHover: '#d4a853',
    borderFocus: '#d4a853',
    placeholderColor: '#6b6058',
    textColor: '#e8e0d0',
    caretColor: '#d4a853',
    fontSizeMedium: '15px',
    fontSizeLarge: '16px',
  },
  Menu: {
    color: '#090a0b',
    itemTextColor: '#9b8e7e',
    itemTextColorActive: '#d4a853',
    itemTextColorHover: '#e8c87a',
    itemColorActive: 'rgba(212, 168, 83, 0.1)',
    itemColorHover: 'rgba(212, 168, 83, 0.05)',
  },
  Tabs: {
    tabTextColorLine: '#9b8e7e',
    tabTextColorActiveLine: '#d4a853',
    tabTextColorHoverLine: '#e8c87a',
    barColor: '#d4a853',
  },
  Select: {
    peers: {
      InternalSelection: {
        color: '#162035',
        textColor: '#e8e0d0',
        placeholderColor: '#6b6058',
        border: '1px solid #2d3a58',
        borderHover: '1px solid #d4a853',
        borderFocus: '1px solid #d4a853',
        borderActive: '1px solid #d4a853',
      },
    },
  },
  Modal: {
    color: '#15120f',
    textColor: '#e8e0d0',
  },
  Alert: {
    color: '#111315',
    titleTextColor: '#e8e0d0',
    contentTextColor: '#9b8e7e',
    borderColor: '#39332a',
  },
  Progress: {
    fillColor: '#d4a853',
    railColor: '#24201a',
  },
  Tooltip: {
    color: '#131516',
    textColor: '#e8e0d0',
  },
  Popconfirm: {
    color: '#15120f',
  },
  Form: {
    labelTextColor: '#9b8e7e',
  },
  Tag: {
    color: 'rgba(212, 168, 83, 0.1)',
    textColor: '#d4a853',
    borderColor: 'rgba(212, 168, 83, 0.2)',
  },
}

// 初始化时从服务器加载共享数据，本地配置从 localStorage 加载
const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()
const aiStore = useAIStore()
const assessmentStore = useAssessmentStore()
const historyStore = useHistoryStore()

// 数据同步（轮询服务器版本更新）
const dataSync = useDataSync()

// 是否为登录页
const isLoginPage = computed(() => route.path === '/login')

// 本地配置类 store 保持 localStorage
// aiStore 同步加载；assessmentStore 需异步解密 API Key
aiStore.loadFromStorage()
assessmentStore.loadFromStorage().catch(err => {
  console.warn('评测配置加载失败:', err)
})

/** 初始化共享数据 store（从服务器加载） */
function initializeDataStores() {
  // 共享数据 store 从服务器加载（服务器优先，失败降级到 localStorage）
  Promise.all([
    worldStore.initializeFromServer(),
    continentsStore.initializeFromServer(),
    landingStore.initializeFromServer(),
    historyStore.initializeFromServer(),
  ]).catch(err => {
    console.warn('服务器数据初始化失败，已降级到本地存储:', err)
  })
}

/** 页面隐藏或卸载前立即写入 localStorage，防止防抖没来得及触发导致数据丢失 */
function flushSave() {
  worldStore.saveNow()
  continentsStore.saveNow()
  landingStore.saveNow()
}

// 监听认证状态变化，登录成功后自动初始化数据
watch(() => authStore.isAuthenticated, (authenticated) => {
  if (authenticated) {
    initializeDataStores()
  }
})

onMounted(async () => {
  // 先检查认证状态
  await authStore.checkAuth()

  // 只有已认证才初始化数据 store
  if (authStore.isAuthenticated) {
    initializeDataStores()
  }

  // 全局 fetch 拦截：任何 API 请求返回 401 时，自动重验身份并跳转登录页
  const _originalFetch = window.fetch
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await _originalFetch(...args)
    if (res.status === 401) {
      // 避免在登录接口本身上死循环
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      if (!url.includes('/api/auth/')) {
        await authStore.checkAuth()
        if (!authStore.isAuthenticated) {
          router.push('/login')
        }
      }
    }
    return res
  }

  // 切换标签页时触发（最常用标项）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })
  // 页面卸载/刷新/关闭时触发
  window.addEventListener('beforeunload', flushSave)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', flushSave)
})
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <!-- 登录页：只显示 RouterView -->
        <template v-if="isLoginPage">
          <router-view v-slot="{ Component }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </template>
        <!-- 已认证：显示完整布局 -->
        <template v-else-if="authStore.isAuthenticated">
          <div class="app-layout">
            <AppHeader />
            <PhaseTabNav />
            <div class="app-body">
              <router-view v-slot="{ Component }">
                <transition name="page-fade" mode="out-in">
                  <component :is="Component" />
                </transition>
              </router-view>
            </div>
            <EditLogPanel />
          </div>
        </template>
        <!-- 检查认证中：显示加载状态 -->
        <template v-else>
          <div class="loading-screen">
            <div class="loading-text">正在验证身份...</div>
          </div>
        </template>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.app-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  width: 100%;
}

.loading-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #090a0b;
}

.loading-text {
  color: #9b8e7e;
  font-size: 14px;
}
</style>
