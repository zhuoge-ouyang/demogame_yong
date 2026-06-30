<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NCard, NDivider, NSpace, NTag, NTooltip, useMessage } from 'naive-ui'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import PptButton from '@/components/shared/PptButton.vue'
import { useWorldStore } from '@/stores/world'
import { OPENING_BATTLE_VERSIONS } from '@/services/prompts/opening-battle-prompts'
import { buildFullPrompt } from '@/services/prompts'
import { syncModuleReferenceBatch } from '@/services/data-api'

const worldStore = useWorldStore()
const message = useMessage()
const s = worldStore.state.openingBattle
const syncingModule = ref(false)

// 所有字段路径（用于批量定稿）
const allFieldPaths = OPENING_BATTLE_VERSIONS.map(v => v.fieldKey)

// Prompt 展开状态
const expandedPrompts = ref<Record<string, boolean>>({})

function togglePrompt(versionId: string) {
  expandedPrompts.value[versionId] = !expandedPrompts.value[versionId]
}

// 定稿相关
function isFinalized(fieldPath: string): boolean {
  return worldStore.isFieldFinalized('openingBattle', fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    worldStore.unfinalizeField('openingBattle', fieldPath)
  } else {
    worldStore.finalizeField('openingBattle', fieldPath)
  }
}

function finalizeAll() {
  worldStore.finalizeModule('openingBattle', allFieldPaths)
}

function unfinalizeAll() {
  for (const fp of allFieldPaths) {
    worldStore.unfinalizeField('openingBattle', fp)
  }
}

// 字段编辑回调
function onFieldInput(fieldPath: string) {
  worldStore.updateFieldEditMeta('openingBattle', fieldPath, 'user')
}

// AI 生成结果接受
function handleAccept(fieldKey: string, content: string) {
  ;(s as any)[fieldKey] = content
  worldStore.updateFieldEditMeta('openingBattle', fieldKey, 'ai')
}

// Prompt 预览
function getPromptPreview(moduleId: string) {
  const result = buildFullPrompt(moduleId)
  if (!result) return '无法构建Prompt——该模块尚未注册到Prompt模板系统'
  return `【系统提示词】\n${result.system}\n\n【用户提示词】\n${result.user}`
}

async function syncOpeningBattle() {
  const payload = Object.fromEntries(
    OPENING_BATTLE_VERSIONS
      .map(version => [version.fieldKey, ((s as any)[version.fieldKey] || '').trim()])
      .filter(([, value]) => value)
  )
  if (Object.keys(payload).length === 0) {
    message.warning('当前模块内容为空，无法同步')
    return
  }
  syncingModule.value = true
  try {
    await syncModuleReferenceBatch('openingBattle', payload)
    message.success('开场大战已同步到提示词参考文件')
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    syncingModule.value = false
  }
}
</script>

<template>
  <div class="content-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <h2>⚔️ 开场大战</h2>
      <NSpace :size="6">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="syncingModule" @click="syncOpeningBattle">⬆同步</NButton>
          </template>
          同步到提示词文件 (opening-battle-refs.ts)
        </NTooltip>
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">史诗级开场战斗剧情</p>
    <p class="battle-intro">
      当前只保留一个主版本：魂域第二场大战中，众神联合凡族打败深渊魂族，将其封入深渊，并促成三界划分。
      点击查看Prompt可预览完整提示词，点击AI生成可创作或改写该剧情。
    </p>

    <div
      v-for="version in OPENING_BATTLE_VERSIONS"
      :key="version.id"
      class="battle-card-wrapper"
    >
      <NCard class="battle-card" :bordered="true">
        <!-- 卡片标题行 -->
        <template #header>
          <div class="battle-card-header">
            <span class="battle-label">{{ version.label }}</span>
            <NTag size="small" type="info" :bordered="false" class="battle-subtitle-tag">
              {{ version.subtitle }}
            </NTag>
          </div>
        </template>

        <!-- 描述文字 -->
        <p class="battle-description">{{ version.description }}</p>

        <!-- 编辑区域 + 定稿按钮 -->
        <div class="field-group">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <label style="flex:1;">{{ version.label }}演绎内容</label>
            <PptButton :ppt-file="version.pptFile" />
            <NTooltip trigger="hover">
              <template #trigger>
                <NButton
                  size="tiny"
                  :type="isFinalized(version.fieldKey) ? 'warning' : 'default'"
                  quaternary
                  @click="toggleFinalize(version.fieldKey)"
                >
                  {{ isFinalized(version.fieldKey) ? '🔒' : '📝' }}
                </NButton>
              </template>
              {{ isFinalized(version.fieldKey) ? '点击解除定稿' : '点击定稿' }}
            </NTooltip>
            <span
              v-if="worldStore.getFieldMeta('openingBattle', version.fieldKey).finalizedBy"
              class="finalized-tag"
              :class="worldStore.getFieldMeta('openingBattle', version.fieldKey).finalizedBy === 'yongge' ? 'client' : 'admin'"
            >
              {{ worldStore.getFieldMeta('openingBattle', version.fieldKey).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
            </span>
          </div>
          <CollabTextField
            v-model="(s as any)[version.fieldKey]"
            :base-content="worldStore.getFieldMeta('openingBattle', version.fieldKey).baseContent || ''"
            :last-edit-by="worldStore.getFieldMeta('openingBattle', version.fieldKey).lastEditBy || ''"
            :placeholder="`请填写${version.label}剧情，最多1200字，或使用AI生成...`"
            :autosize="{ minRows: 3, maxRows: 30 }"
            :maxlength="1200"
            show-count
            :disabled="isFinalized(version.fieldKey)"
            show-expand-button
            :field-label="version.label + '演绎内容'"
            @input="onFieldInput(version.fieldKey)"
          />
        </div>

        <NDivider />

        <!-- 操作按钮：查看Prompt -->
        <div class="battle-actions">
          <NButton
            size="small"
            quaternary
            @click="togglePrompt(version.id)"
          >
            {{ expandedPrompts[version.id] ? '收起 Prompt' : '查看 Prompt' }}
          </NButton>
        </div>

        <!-- 展开的 Prompt 文本 -->
        <div v-if="expandedPrompts[version.id]" class="prompt-preview">
          {{ getPromptPreview(version.id) }}
        </div>

        <NDivider />

        <!-- AIPanel 组件 -->
        <AIPanel
          :module-id="version.id"
          :generate-only="true"
          :context-labels="['三界结构', '主线剧情', '英雄系统', '世界树系统', '城堡女神', '玩家身份']"
          @accept="(content: string) => handleAccept(version.fieldKey, content)"
          @accept-partial="(content: string) => handleAccept(version.fieldKey, content)"
        />
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.battle-intro {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-bottom: 32px;
}

.battle-card-wrapper {
  margin-bottom: 24px;
}

.battle-card {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

.battle-card :deep(.n-card-header) {
  padding: 16px 20px 12px;
}

.battle-card :deep(.n-card__content) {
  padding: 12px 20px 20px;
}

.battle-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.battle-label {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-accent-gold);
  font-family: var(--font-display);
}

.battle-subtitle-tag {
  font-size: 12px;
}

.battle-description {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0 0 8px;
}

.battle-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.prompt-preview {
  margin-top: 12px;
  background: #07091a;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-secondary);
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.4);
}

.field-group {
  margin-bottom: 16px;
}
</style>
