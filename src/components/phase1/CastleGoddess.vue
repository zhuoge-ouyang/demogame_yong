<script setup lang="ts">
import { ref, computed } from 'vue'
import { NInput, NDivider, NButton, NTooltip, NSpace, useMessage } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections } from '@/services/ai-content-parser'
import { syncModuleReferenceBatch } from '@/services/data-api'

const worldStore = useWorldStore()
const message = useMessage()
const castle = worldStore.state.castleGoddess.castle
const goddess = worldStore.state.castleGoddess.goddess
const syncingModule = ref(false)

// === 两步式生成范围 ===
type GenerationScope = 'outline' | 'detail'
const generationScope = ref<GenerationScope>('outline')

const currentModuleId = computed(() =>
  generationScope.value === 'outline'
    ? 'castle-goddess-outline'
    : 'castle-goddess-detail'
)

const scopeOptions = [
  { value: 'outline' as const, label: 'Step 1 · 设定纲要' },
  { value: 'detail' as const, label: 'Step 2 · 完整详述' }
]

// === 纲要状态（localStorage 持久化） ===
const OUTLINE_STORAGE_KEY = 'castleGoddessOutline'
interface OutlineState {
  text: string
  generatedAt: number
  confirmed: boolean
}
const outline = ref<OutlineState>({ text: '', generatedAt: 0, confirmed: false })

// 初始挂载时恢复
try {
  const restored = localStorage.getItem(OUTLINE_STORAGE_KEY)
  if (restored) outline.value = JSON.parse(restored)
} catch { /* ignore */ }

function persistOutline() {
  try {
    localStorage.setItem(OUTLINE_STORAGE_KEY, JSON.stringify(outline.value))
  } catch { /* ignore quota */ }
}

function confirmOutline() {
  if (!outline.value.text.trim()) return
  outline.value.confirmed = true
  persistOutline()
}

function unlockOutline() {
  outline.value.confirmed = false
  persistOutline()
}

function clearOutline() {
  if (!confirm('确定清空当前纲要并回到 Step 1？')) return
  outline.value = { text: '', generatedAt: 0, confirmed: false }
  try { localStorage.removeItem(OUTLINE_STORAGE_KEY) } catch { /* ignore */ }
  generationScope.value = 'outline'
}

// === extraContext 向 AIPanel 注入纲要 ===
const extraContext = computed(() => {
  const ctx: Record<string, string> = {}
  if (generationScope.value === 'detail' && outline.value.text) {
    ctx['OUTLINE_CONTEXT'] = outline.value.text
  }
  return ctx
})

const allFieldPaths = [
  'castle.description', 'castle.significance',
  'goddess.name', 'goddess.appearance', 'goddess.personality',
]

const fieldLabels: Record<string, string> = {
  'castle.description': '城堡描述', 'castle.significance': '叙事意义',
  'goddess.name': '女神名字', 'goddess.appearance': '外观描述', 'goddess.personality': '性格设定',
}

function isFinalized(fieldPath: string): boolean {
  return worldStore.isFieldFinalized('castleGoddess', fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    worldStore.unfinalizeField('castleGoddess', fieldPath)
  } else {
    worldStore.finalizeField('castleGoddess', fieldPath)
  }
}

function finalizeAll() {
  worldStore.finalizeModule('castleGoddess', allFieldPaths)
}

function unfinalizeAll() {
  for (const fp of allFieldPaths) {
    worldStore.unfinalizeField('castleGoddess', fp)
  }
}

function onFieldInput(fieldPath: string) {
  worldStore.updateFieldEditMeta('castleGoddess', fieldPath, 'user')
}

function checkFieldConflicts(): ConflictField[] {
  // outline 阶段不写入正式字段，无冲突风险
  if (currentModuleId.value === 'castle-goddess-outline') return []
  const conflicts: ConflictField[] = []
  for (const fp of allFieldPaths) {
    const meta = worldStore.getFieldMeta('castleGoddess', fp)
    if (meta.status === 'finalized' || meta.lastEditSource === 'user') {
      conflicts.push({ fieldPath: fp, label: fieldLabels[fp] || fp, meta })
    }
  }
  return conflicts
}

const sectionToField: Record<string, string> = {
  '城堡描述': 'castle.description', '城堡意义': 'castle.significance',
  '女神名字': 'goddess.name', '女神外观': 'goddess.appearance', '女神性格': 'goddess.personality',
}

function handleAIAccept(content: string, skippedFields?: string[]) {
  // === outline 分支：不写入 world.json，只入 localStorage ===
  if (currentModuleId.value === 'castle-goddess-outline') {
    outline.value = {
      text: content,
      generatedAt: Date.now(),
      confirmed: false
    }
    persistOutline()
    return
  }

  // === detail 分支：解析可见字段，写入业务字段 ===
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])

  const assignments: Array<[string, string]> = [
    ['城堡描述', 'castle.description'],
    ['城堡意义', 'castle.significance'],
    ['女神名字', 'goddess.name'],
    ['女神外观', 'goddess.appearance'],
    ['女神性格', 'goddess.personality']
  ]
  const applyField = (sectionKey: string, fieldPath: string) => {
    if (sections[sectionKey] && !skip.has(fieldPath)) {
      const [top, sub] = fieldPath.split('.')
      if (top === 'castle') (castle as any)[sub] = sections[sectionKey]
      if (top === 'goddess') (goddess as any)[sub] = sections[sectionKey]
      worldStore.updateFieldEditMeta('castleGoddess', fieldPath, 'ai')
    }
  }
  for (const [k, fp] of assignments) applyField(k, fp)

  if (Object.keys(sections).length === 0 && content.trim() && !skip.has('castle.description')) {
    castle.description = content
    worldStore.updateFieldEditMeta('castleGoddess', 'castle.description', 'ai')
  }
}

async function syncCastleGoddess() {
  const entries: Array<[string, string]> = [
    ['castleDescription', castle.description],
    ['castleSignificance', castle.significance],
    ['goddessName', goddess.name],
    ['goddessAppearance', goddess.appearance],
    ['goddessPersonality', goddess.personality]
  ]
  const payload = Object.fromEntries(entries.map(([key, value]) => [key, value?.trim() || '']).filter(([, value]) => value))
  if (Object.keys(payload).length === 0) {
    message.warning('当前模块内容为空，无法同步')
    return
  }
  syncingModule.value = true
  try {
    await syncModuleReferenceBatch('castleGoddess', payload)
    message.success('城堡与女神已同步到提示词参考文件')
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
      <h2>城堡与女神设定</h2>
      <NSpace :size="6">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="syncingModule" @click="syncCastleGoddess">⬆同步</NButton>
          </template>
          同步到提示词文件 (castle-goddess-refs.ts)
        </NTooltip>
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">设计城堡的叙事意义和女神NPC的完整人设。</p>

    <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">城堡设计</h3>

    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">城堡描述</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('castle.description') ? 'warning' : 'default'" quaternary @click="toggleFinalize('castle.description')">{{ isFinalized('castle.description') ? '🔒' : '📝' }}</NButton>
          </template>
          {{ isFinalized('castle.description') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('castleGoddess', 'castle.description').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('castleGoddess', 'castle.description').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('castleGoddess', 'castle.description').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField v-model="castle.description" :base-content="worldStore.getFieldMeta('castleGoddess', 'castle.description').baseContent || ''" :last-edit-by="worldStore.getFieldMeta('castleGoddess', 'castle.description').lastEditBy || ''" placeholder="城堡的来源、外观、与世界树的关联..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized('castle.description')" show-expand-button field-label="城堡描述" @input="onFieldInput('castle.description')" />
    </div>
    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">叙事意义</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('castle.significance') ? 'warning' : 'default'" quaternary @click="toggleFinalize('castle.significance')">{{ isFinalized('castle.significance') ? '🔒' : '📝' }}</NButton>
          </template>
          {{ isFinalized('castle.significance') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('castleGoddess', 'castle.significance').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('castleGoddess', 'castle.significance').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('castleGoddess', 'castle.significance').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField v-model="castle.significance" :base-content="worldStore.getFieldMeta('castleGoddess', 'castle.significance').baseContent || ''" :last-edit-by="worldStore.getFieldMeta('castleGoddess', 'castle.significance').lastEditBy || ''" placeholder="城堡在故事中的象征意义..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized('castle.significance')" show-expand-button field-label="叙事意义" @input="onFieldInput('castle.significance')" />
    </div>

    <NDivider />

    <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">女神设计</h3>

    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">女神名字</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('goddess.name') ? 'warning' : 'default'" quaternary @click="toggleFinalize('goddess.name')">{{ isFinalized('goddess.name') ? '🔒' : '📝' }}</NButton>
          </template>
          {{ isFinalized('goddess.name') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('castleGoddess', 'goddess.name').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('castleGoddess', 'goddess.name').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('castleGoddess', 'goddess.name').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <NInput v-model:value="goddess.name" placeholder="西幻风格的名字" :maxlength="500" :disabled="isFinalized('goddess.name')" :style="isFinalized('goddess.name') ? 'opacity: 0.7;' : ''" :class="{ 'edited-by-client': worldStore.getFieldMeta('castleGoddess', 'goddess.name').lastEditBy === 'yongge' }" @input="onFieldInput('goddess.name')" />
    </div>
    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">外观描述</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('goddess.appearance') ? 'warning' : 'default'" quaternary @click="toggleFinalize('goddess.appearance')">{{ isFinalized('goddess.appearance') ? '🔒' : '📝' }}</NButton>
          </template>
          {{ isFinalized('goddess.appearance') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('castleGoddess', 'goddess.appearance').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('castleGoddess', 'goddess.appearance').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('castleGoddess', 'goddess.appearance').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField v-model="goddess.appearance" :base-content="worldStore.getFieldMeta('castleGoddess', 'goddess.appearance').baseContent || ''" :last-edit-by="worldStore.getFieldMeta('castleGoddess', 'goddess.appearance').lastEditBy || ''" placeholder="女神的视觉特征..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized('goddess.appearance')" show-expand-button field-label="外观描述" @input="onFieldInput('goddess.appearance')" />
    </div>
    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">性格设定</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('goddess.personality') ? 'warning' : 'default'" quaternary @click="toggleFinalize('goddess.personality')">{{ isFinalized('goddess.personality') ? '🔒' : '📝' }}</NButton>
          </template>
          {{ isFinalized('goddess.personality') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('castleGoddess', 'goddess.personality').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('castleGoddess', 'goddess.personality').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('castleGoddess', 'goddess.personality').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField v-model="goddess.personality" :base-content="worldStore.getFieldMeta('castleGoddess', 'goddess.personality').baseContent || ''" :last-edit-by="worldStore.getFieldMeta('castleGoddess', 'goddess.personality').lastEditBy || ''" placeholder="表面性格与深层性格..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized('goddess.personality')" show-expand-button field-label="性格设定" @input="onFieldInput('goddess.personality')" />
    </div>

    <NDivider />

    <!-- 两步式生成切换器 -->
    <div class="generation-scope-selector">
      <button
        v-for="item in scopeOptions"
        :key="item.value"
        :class="['scope-btn', { active: generationScope === item.value }]"
        :disabled="item.value === 'detail' && !outline.confirmed"
        :title="item.value === 'detail' && !outline.confirmed ? '请先完成并确认 Step 1 的设定纲要' : ''"
        @click="generationScope = item.value"
      >
        {{ item.label }}
      </button>
      <span class="scope-hint">
        {{ generationScope === 'outline'
          ? 'Step 1：AI 先产出设定纲要，不写入正式字段'
          : 'Step 2：基于纲要扩展为可见正式字段' }}
      </span>
    </div>

    <!-- 纲要预览/编辑卡片 -->
    <div v-if="outline.text" class="outline-card" :class="{ confirmed: outline.confirmed }">
      <div class="outline-card-header">
        <span class="outline-label">设定纲要</span>
        <span class="outline-status" :class="{ confirmed: outline.confirmed }">
          {{ outline.confirmed ? '✓ 已确认' : '草稿，待确认' }}
        </span>
      </div>
      <textarea
        v-model="outline.text"
        class="outline-textarea"
        :maxlength="5000"
        :readonly="outline.confirmed"
        rows="8"
        @blur="persistOutline"
      />
      <div class="outline-card-actions">
        <NButton v-if="!outline.confirmed" size="small" type="primary" @click="confirmOutline">确认作为 Step 2 输入</NButton>
        <NButton v-if="outline.confirmed" size="small" @click="unlockOutline">解锁编辑</NButton>
        <NButton size="small" type="error" quaternary @click="clearOutline">清空纲要并重新开始</NButton>
      </div>
    </div>

    <AIPanel
      :module-id="currentModuleId"
      :context-labels="['三界结构', '玩家身份', '英雄系统']"
      :extra-context="extraContext"
      :check-field-conflicts="checkFieldConflicts"
      @accept="(c: string) => handleAIAccept(c)"
      @accept-partial="(c: string, skipped: string[]) => handleAIAccept(c, skipped)"
    />
  </div>
</template>

<style scoped>
.generation-scope-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 12px;
  flex-wrap: wrap;
}
.scope-btn {
  padding: 6px 14px;
  border: 1px solid rgba(236, 204, 142, 0.18);
  background: rgba(255, 240, 200, 0.035);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  transition: all .15s ease;
}
.scope-btn:hover:not(:disabled) {
  border-color: rgba(248, 207, 122, 0.5);
  color: var(--epic-halo);
  background: rgba(248, 207, 122, 0.08);
}
.scope-btn.active {
  background: linear-gradient(180deg, rgba(248, 207, 122, 0.2), rgba(138, 90, 42, 0.12));
  color: var(--epic-halo);
  border-color: rgba(248, 207, 122, 0.48);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.1), 0 0 16px -12px rgba(248, 207, 122, 0.9);
}
.scope-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.03);
}
.scope-hint { font-size: 12px; color: var(--color-text-tertiary); margin-left: 6px; }

.outline-card {
  margin: 12px 0 16px;
  padding: 14px 16px;
  border: 1px solid rgba(236, 204, 142, 0.16);
  background: linear-gradient(180deg, rgba(22, 17, 12, 0.94), rgba(14, 10, 7, 0.97));
  border-radius: var(--radius-md, 8px);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.06);
}
.outline-card.confirmed {
  border-color: rgba(248, 207, 122, 0.45);
  background: linear-gradient(180deg, rgba(35, 26, 16, 0.95), rgba(18, 13, 9, 0.98));
}
.outline-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.outline-label { font-weight: 600; color: var(--epic-halo); font-size: 14px; }
.outline-status {
  font-size: 12px;
  color: var(--color-accent-gold-light);
  padding: 2px 8px;
  background: rgba(248, 207, 122, 0.1);
  border: 1px solid rgba(248, 207, 122, 0.22);
  border-radius: 10px;
}
.outline-status.confirmed { color: #140f0a; background: var(--epic-halo); }
.outline-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid rgba(236, 204, 142, 0.16);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  color: var(--color-text);
  font-size: 13px;
  font-family: var(--font-serif, 'Source Han Serif SC', 'Noto Serif SC', serif);
  line-height: 1.7;
  resize: vertical;
  outline: none;
}
.outline-textarea:focus {
  border-color: rgba(248, 207, 122, 0.55);
  box-shadow: 0 0 0 2px rgba(248, 207, 122, 0.14);
}
.outline-textarea[readonly] { background: rgba(255, 240, 200, 0.035); cursor: default; }
.outline-card-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
</style>
