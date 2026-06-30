<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { NTabs, NTabPane, NInput, NButton, NSpace, NIcon, useMessage } from 'naive-ui'
import { useOpinionsStore } from '@/stores/opinions'
import EpicBanner from '@/components/shared/EpicBanner.vue'

const message = useMessage()
const opinionsStore = useOpinionsStore()

// 各轮次的本地编辑内容（key = roundId）
const localContents = reactive<Record<number, string>>({})
// 各轮次的保存加载状态
const loadingMap = reactive<Record<number, boolean>>({})
// 当前激活页签
const activeTab = ref<string>('')
// 新增轮次加载状态
const addingRound = ref(false)
// 数据加载状态
const fetching = ref(true)

onMounted(async () => {
  fetching.value = true
  await opinionsStore.fetchOpinions()
  fetching.value = false
  // 初始化本地内容
  for (const round of opinionsStore.state.rounds) {
    localContents[round.id] = round.content
  }
  // 默认激活第一个页签
  if (opinionsStore.state.rounds.length > 0) {
    activeTab.value = String(opinionsStore.state.rounds[0].id)
  }
})

async function handleSave(roundId: number) {
  loadingMap[roundId] = true
  const success = await opinionsStore.saveRound(roundId, localContents[roundId] ?? '')
  loadingMap[roundId] = false
  if (success) {
    message.success('保存成功')
  } else {
    message.error('保存失败，请重试')
  }
}

async function handleAddRound() {
  addingRound.value = true
  const round = await opinionsStore.addRound()
  addingRound.value = false
  if (round) {
    localContents[round.id] = ''
    activeTab.value = String(round.id)
    // 如果是降级创建（updatedAt为null且寄存在前端），提示需重启服务器
    message.success(`已新增「${round.label}」（请重启服务器以持久保存）`)
  } else {
    message.error('新增轮次失败，请重试')
  }
}

function formatUpdateInfo(roundId: number): string {
  const round = opinionsStore.state.rounds.find(r => r.id === roundId)
  if (!round || !round.updatedAt) return '暂无更新记录'
  const timeStr = new Date(round.updatedAt).toLocaleString('zh-CN')
  return `最后更新：${timeStr} · 更新者：${round.updatedBy || '未知用户'}`
}
</script>

<template>
  <div class="opinions-page">
    <EpicBanner
      kicker="COUNCIL · DECREE"
      title="甲方意见"
      subtitle="议事厅的卷轴 — 轮次记录与定稿"
      image="/images/banners/opinions.png"
      seal-char="✠"
      accent="blood"
      height="short"
    />
    <div class="opinions-container">
      <div class="page-header">
        <h2 class="page-title">甲方意见</h2>
        <NButton
          size="small"
          type="primary"
          ghost
          :loading="addingRound"
          @click="handleAddRound"
        >
          + 新增一次意见
        </NButton>
      </div>

      <!-- 加载中 -->
      <div v-if="fetching" class="empty-tip">正在加载…</div>

      <!-- 加载完但无数据 -->
      <div v-else-if="opinionsStore.state.rounds.length === 0" class="empty-tip">
        暂无意见数据，点击右上角「+ 新增一次意见」开始
      </div>

      <!-- 轮次页签 -->
      <NTabs
        v-else
        v-model:value="activeTab"
        type="line"
        animated
        class="opinion-tabs"
      >
        <NTabPane
          v-for="round in opinionsStore.state.rounds"
          :key="round.id"
          :name="String(round.id)"
          :tab="round.label"
        >
          <div class="tab-content">
            <NInput
              v-model:value="localContents[round.id]"
              type="textarea"
              :rows="6"
              :placeholder="`请输入${round.label}内容…`"
              class="opinion-input"
              resize="none"
            />
            <div class="tab-footer">
              <NButton
                type="primary"
                :loading="loadingMap[round.id]"
                @click="handleSave(round.id)"
              >
                保存
              </NButton>
              <span class="update-info">{{ formatUpdateInfo(round.id) }}</span>
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.opinions-page {
  width: 100%;
  height: calc(100vh - var(--header-height) - var(--tab-height));
  background: var(--color-bg-primary);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.opinions-container {
  width: 100%;
  flex: 1;
  max-width: none;
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: var(--font-size-h2);
  color: var(--color-text);
  margin: 0;
  font-weight: 600;
}

.empty-tip {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  padding: 40px 0;
  text-align: center;
}

.opinion-tabs {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 0 20px 20px;
  width: 100%;
  flex: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* NTabs 根元素和内部面板纵向撑满 */
.opinion-tabs :deep(.n-tabs) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.opinion-tabs :deep(.n-tabs-pane-wrapper) {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.opinion-tabs :deep(.n-tab-pane) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 页签栏文字颜色 */
.opinion-tabs :deep(.n-tabs-tab) {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.opinion-tabs :deep(.n-tabs-tab.n-tabs-tab--active) {
  color: var(--color-accent-gold);
  font-weight: 600;
}

.opinion-tabs :deep(.n-tabs-bar) {
  background: var(--color-accent-gold);
}

.tab-content {
  padding-top: 16px;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.opinion-input {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.opinion-input :deep(.n-input) {
  width: 100%;
  height: 100%;
}

.opinion-input :deep(.n-input-wrapper) {
  height: 100%;
}

.opinion-input :deep(.n-input__textarea) {
  height: 100%;
}

.opinion-input :deep(textarea) {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.7;
  height: 100% !important;
}

.opinion-input :deep(textarea::placeholder) {
  color: var(--color-text-tertiary);
}

.opinion-input :deep(textarea:focus) {
  border-color: var(--color-accent-gold);
  box-shadow: 0 0 0 2px var(--color-glow-gold);
}

.tab-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.update-info {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
</style>
