<script setup lang="ts">
import { ref, computed } from 'vue'
import { NInput, NDivider, NButton, NTooltip, NSpace, useMessage } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections } from '@/services/ai-content-parser'
import { syncModuleReference } from '@/services/data-api'

const worldStore = useWorldStore()
const s = worldStore.state.mainStoryline
const message = useMessage()

/** 同步中的字段路径（用于 loading 状态） */
const syncingFields = ref<Set<string>>(new Set())

/** 主线字段路径 → storyline-chapter1-refs.ts 中的字段名映射 */
const STORYLINE_FIELD_MAP: Record<string, string> = {
  'overview': 'overview',
  'stages.0.goal': 'chapter1Goal',
  'stages.0.events': 'chapter1Events',
  'stages.0.resolution': 'chapter1Resolution',
  'stages.1.goal': 'chapter2Goal',
  'stages.1.events': 'chapter2Events',
  'stages.1.resolution': 'chapter2Resolution',
  'stages.2.goal': 'chapter3Goal',
  'stages.2.events': 'chapter3Events',
  'stages.2.resolution': 'chapter3Resolution',
}

async function handleStorylineSync(storeFieldPath: string) {
  const refField = STORYLINE_FIELD_MAP[storeFieldPath]
  if (!refField) return

  let content = ''
  if (storeFieldPath === 'overview') {
    content = s.overview || ''
  } else {
    const parts = storeFieldPath.split('.')
    const stageIdx = parseInt(parts[1])
    const fieldName = parts[2] as 'goal' | 'events' | 'resolution'
    content = s.stages[stageIdx]?.[fieldName] || ''
  }

  if (!content || !content.trim()) {
    message.warning('该字段内容为空，无法同步')
    return
  }

  syncingFields.value.add(storeFieldPath)
  try {
    await syncModuleReference('storyline', refField, content)
    message.success('已同步到提示词文件')
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    syncingFields.value.delete(storeFieldPath)
    syncingFields.value = new Set(syncingFields.value)
  }
}

function isSyncing(fieldPath: string): boolean {
  return syncingFields.value.has(fieldPath)
}

// === 逐章生成范围 ===
const generationScope = ref<'overview' | 'chapter1' | 'chapter2' | 'chapter3'>('overview')

const scopeOptions = [
  { value: 'overview' as const, label: '整体概述' },
  { value: 'chapter1' as const, label: '第一章' },
  { value: 'chapter2' as const, label: '第二章' },
  { value: 'chapter3' as const, label: '第三章' }
]

const currentModuleId = computed(() => {
  const map = {
    overview: 'main-storyline-overview',
    chapter1: 'main-storyline-chapter1',
    chapter2: 'main-storyline-chapter2',
    chapter3: 'main-storyline-chapter3'
  }
  return map[generationScope.value]
})

// === 前序章节字段截断 ===
function truncateField(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text
  return text.slice(0, maxChars) + '...'
}

const extraContext = computed(() => {
  const ctx: Record<string, string> = {}
  
  // 注入概述
  if (s.overview && generationScope.value !== 'overview') {
    ctx['OVERVIEW_CONTEXT'] = s.overview
  }
  
  // 注入前序章节（结构化标记格式，带字数限制）
  if (generationScope.value === 'chapter2' || generationScope.value === 'chapter3') {
    let prev = ''
    if (s.stages[0].name) {
      prev += `【第一章节·名称】${s.stages[0].name}\n`
      prev += `【第一章节·核心目标】\n${truncateField(s.stages[0].goal, 400)}\n`
      prev += `【第一章节·关键事件】\n${truncateField(s.stages[0].events, 400)}\n`
      prev += `【第一章节·章节结局】\n${truncateField(s.stages[0].resolution, 300)}\n\n`
    }
    if (generationScope.value === 'chapter3' && s.stages[1].name) {
      prev += `【第二章节·名称】${s.stages[1].name}\n`
      prev += `【第二章节·核心目标】\n${truncateField(s.stages[1].goal, 400)}\n`
      prev += `【第二章节·关键事件】\n${truncateField(s.stages[1].events, 400)}\n`
      prev += `【第二章节·章节结局】\n${truncateField(s.stages[1].resolution, 300)}\n`
    }
    if (prev) ctx['PREVIOUS_CHAPTERS_CONTEXT'] = prev
  }
  
  return ctx
})

// 智能提示：概述为空且选择了章节
const scopeWarning = computed(() => {
  if (generationScope.value !== 'overview' && !s.overview) {
    return '建议先生成整体概述，再生成各章节内容'
  }
  return ''
})

const allFieldPaths = [
  'overview',
  ...([0, 1, 2] as const).flatMap(i => [`stages.${i}.name`, `stages.${i}.goal`, `stages.${i}.events`, `stages.${i}.resolution`])
]

function isFinalized(fieldPath: string): boolean {
  return worldStore.isFieldFinalized('mainStoryline', fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    worldStore.unfinalizeField('mainStoryline', fieldPath)
  } else {
    worldStore.finalizeField('mainStoryline', fieldPath)
  }
}

function finalizeAll() {
  worldStore.finalizeModule('mainStoryline', allFieldPaths)
}

function unfinalizeAll() {
  for (const fp of allFieldPaths) {
    worldStore.unfinalizeField('mainStoryline', fp)
  }
}

function onFieldInput(fieldPath: string) {
  worldStore.updateFieldEditMeta('mainStoryline', fieldPath, 'user')
}

function checkFieldConflicts(): ConflictField[] {
  const conflicts: ConflictField[] = []
  for (const fp of allFieldPaths) {
    const meta = worldStore.getFieldMeta('mainStoryline', fp)
    if (meta.status === 'finalized' || meta.lastEditSource === 'user') {
      conflicts.push({ fieldPath: fp, label: fp, meta })
    }
  }
  return conflicts
}

function handleAIAccept(content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])
  const scope = generationScope.value

  // scope=overview → 只回填 overview
  if (scope === 'overview') {
    if (sections['整体概述'] && !skip.has('overview')) {
      s.overview = sections['整体概述']
      worldStore.updateFieldEditMeta('mainStoryline', 'overview', 'ai')
    } else if (Object.keys(sections).length === 0 && content.trim() && !skip.has('overview')) {
      s.overview = content
      worldStore.updateFieldEditMeta('mainStoryline', 'overview', 'ai')
    }
    return
  }

  // scope=chapter1/2/3 → 只回填对应章节 stages[i]
  const scopeToIndex: Record<string, number> = { chapter1: 0, chapter2: 1, chapter3: 2 }
  const i = scopeToIndex[scope]
  const stageLabels = ['第一', '第二', '第三']
  const prefix = stageLabels[i]

  const getName = () => sections[`${prefix}章节·名称`] || sections[`${prefix}阶段-名称`]
  const getGoal = () => {
    const bg = sections[`${prefix}章节·时代背景`] || ''
    const chars = sections[`${prefix}章节·关键角色`] || ''
    const player = sections[`${prefix}章节·玩家参与`] || ''
    if (bg || chars || player) {
      return [bg, chars, player].filter(Boolean).join('\n\n')
    }
    return sections[`${prefix}阶段-目标`] || ''
  }
  const getEvents = () => sections[`${prefix}章节·核心事件`] || sections[`${prefix}阶段-事件`]
  const getResolution = () => sections[`${prefix}章节·结局`] || sections[`${prefix}章节·现状结局`] || sections[`${prefix}阶段-结局`]

  const name = getName()
  if (name && !skip.has(`stages.${i}.name`)) {
    s.stages[i].name = name
    worldStore.updateFieldEditMeta('mainStoryline', `stages.${i}.name`, 'ai')
  }

  const goal = getGoal()
  if (goal && !skip.has(`stages.${i}.goal`)) {
    s.stages[i].goal = goal
    worldStore.updateFieldEditMeta('mainStoryline', `stages.${i}.goal`, 'ai')
  }

  const events = getEvents()
  if (events && !skip.has(`stages.${i}.events`)) {
    s.stages[i].events = events
    worldStore.updateFieldEditMeta('mainStoryline', `stages.${i}.events`, 'ai')
  }

  const resolution = getResolution()
  if (resolution && !skip.has(`stages.${i}.resolution`)) {
    s.stages[i].resolution = resolution
    worldStore.updateFieldEditMeta('mainStoryline', `stages.${i}.resolution`, 'ai')
  }
}
</script>

<template>
  <div class="content-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <h2>主线三章节目标</h2>
      <NSpace :size="6">
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">梳理方舟堡/玩家意识在前三个元素大陆（金、冰、火）的目标、关键事件与通关变化。</p>

    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">主线整体概述</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('overview') ? 'warning' : 'default'" quaternary @click="toggleFinalize('overview')">
              {{ isFinalized('overview') ? '🔒' : '📝' }}
            </NButton>
          </template>
          {{ isFinalized('overview') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <NTooltip v-if="isFinalized('overview')" trigger="hover">
          <template #trigger>
            <NButton
              size="tiny"
              quaternary
              type="primary"
              :loading="isSyncing('overview')"
              @click="handleStorylineSync('overview')"
            >
              ⬆同步
            </NButton>
          </template>
          同步到提示词文件 (storyline-chapter1-refs.ts → overview)
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('mainStoryline', 'overview').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('mainStoryline', 'overview').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('mainStoryline', 'overview').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField
        v-model="s.overview"
        :base-content="worldStore.getFieldMeta('mainStoryline', 'overview').baseContent || ''"
        :last-edit-by="worldStore.getFieldMeta('mainStoryline', 'overview').lastEditBy || ''"
        placeholder="用一段话概括前三章节的目标递进..."
        :autosize="{ minRows: 3, maxRows: 30 }"
        :maxlength="20000"
        show-count
        :disabled="isFinalized('overview')"
        show-expand-button
        field-label="主线整体概述"
        @input="onFieldInput('overview')"
      />
    </div>

    <NDivider />

    <div v-for="(stage, index) in s.stages" :key="index" style="margin-bottom:32px;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">
        {{ stage.name || `第${index + 1}章节` }}
      </h3>

      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="flex:1;">章节名称</label>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" :type="isFinalized(`stages.${index}.name`) ? 'warning' : 'default'" quaternary @click="toggleFinalize(`stages.${index}.name`)">
                {{ isFinalized(`stages.${index}.name`) ? '🔒' : '📝' }}
              </NButton>
            </template>
            {{ isFinalized(`stages.${index}.name`) ? '点击解除定稿' : '点击定稿' }}
          </NTooltip>
          <span
            v-if="worldStore.getFieldMeta('mainStoryline', `stages.${index}.name`).finalizedBy"
            class="finalized-tag"
            :class="worldStore.getFieldMeta('mainStoryline', `stages.${index}.name`).finalizedBy === 'yongge' ? 'client' : 'admin'"
          >
            {{ worldStore.getFieldMeta('mainStoryline', `stages.${index}.name`).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
          </span>
        </div>
        <NInput v-model:value="stage.name" placeholder="如：第一阶段 - 凡界篇" :maxlength="500" :disabled="isFinalized(`stages.${index}.name`)" :style="isFinalized(`stages.${index}.name`) ? 'opacity: 0.7;' : ''" :class="{ 'edited-by-client': worldStore.getFieldMeta('mainStoryline', `stages.${index}.name`).lastEditBy === 'yongge' }" @input="onFieldInput(`stages.${index}.name`)" />
      </div>

      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="flex:1;">核心目标</label>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" :type="isFinalized(`stages.${index}.goal`) ? 'warning' : 'default'" quaternary @click="toggleFinalize(`stages.${index}.goal`)">
                {{ isFinalized(`stages.${index}.goal`) ? '🔒' : '📝' }}
              </NButton>
            </template>
            {{ isFinalized(`stages.${index}.goal`) ? '点击解除定稿' : '点击定稿' }}
          </NTooltip>
          <NTooltip v-if="isFinalized(`stages.${index}.goal`)" trigger="hover">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                type="primary"
                :loading="isSyncing(`stages.${index}.goal`)"
                @click="handleStorylineSync(`stages.${index}.goal`)"
              >
                ⬆同步
              </NButton>
            </template>
            同步到提示词文件 (storyline-chapter1-refs.ts → chapter{{ index + 1 }}Goal)
          </NTooltip>
          <span
            v-if="worldStore.getFieldMeta('mainStoryline', `stages.${index}.goal`).finalizedBy"
            class="finalized-tag"
            :class="worldStore.getFieldMeta('mainStoryline', `stages.${index}.goal`).finalizedBy === 'yongge' ? 'client' : 'admin'"
          >
            {{ worldStore.getFieldMeta('mainStoryline', `stages.${index}.goal`).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
          </span>
        </div>
        <CollabTextField v-model="stage.goal" :base-content="worldStore.getFieldMeta('mainStoryline', `stages.${index}.goal`).baseContent || ''" :last-edit-by="worldStore.getFieldMeta('mainStoryline', `stages.${index}.goal`).lastEditBy || ''" placeholder="这个章节方舟堡/玩家意识的核心目标是什么..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized(`stages.${index}.goal`)" show-expand-button :field-label="`第${index+1}章节 核心目标`" @input="onFieldInput(`stages.${index}.goal`)" />
      </div>

      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="flex:1;">关键事件</label>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" :type="isFinalized(`stages.${index}.events`) ? 'warning' : 'default'" quaternary @click="toggleFinalize(`stages.${index}.events`)">
                {{ isFinalized(`stages.${index}.events`) ? '🔒' : '📝' }}
              </NButton>
            </template>
            {{ isFinalized(`stages.${index}.events`) ? '点击解除定稿' : '点击定稿' }}
          </NTooltip>
          <NTooltip v-if="isFinalized(`stages.${index}.events`)" trigger="hover">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                type="primary"
                :loading="isSyncing(`stages.${index}.events`)"
                @click="handleStorylineSync(`stages.${index}.events`)"
              >
                ⬆同步
              </NButton>
            </template>
            同步到提示词文件 (storyline-chapter1-refs.ts → chapter{{ index + 1 }}Events)
          </NTooltip>
          <span
            v-if="worldStore.getFieldMeta('mainStoryline', `stages.${index}.events`).finalizedBy"
            class="finalized-tag"
            :class="worldStore.getFieldMeta('mainStoryline', `stages.${index}.events`).finalizedBy === 'yongge' ? 'client' : 'admin'"
          >
            {{ worldStore.getFieldMeta('mainStoryline', `stages.${index}.events`).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
          </span>
        </div>
        <CollabTextField v-model="stage.events" :base-content="worldStore.getFieldMeta('mainStoryline', `stages.${index}.events`).baseContent || ''" :last-edit-by="worldStore.getFieldMeta('mainStoryline', `stages.${index}.events`).lastEditBy || ''" placeholder="严格3个情节点，合计300-500字..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized(`stages.${index}.events`)" show-expand-button :field-label="`第${index+1}章节 关键事件`" @input="onFieldInput(`stages.${index}.events`)" />
      </div>

      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="flex:1;">章节结局 / 过渡</label>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" :type="isFinalized(`stages.${index}.resolution`) ? 'warning' : 'default'" quaternary @click="toggleFinalize(`stages.${index}.resolution`)">
                {{ isFinalized(`stages.${index}.resolution`) ? '🔒' : '📝' }}
              </NButton>
            </template>
            {{ isFinalized(`stages.${index}.resolution`) ? '点击解除定稿' : '点击定稿' }}
          </NTooltip>
          <NTooltip v-if="isFinalized(`stages.${index}.resolution`)" trigger="hover">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                type="primary"
                :loading="isSyncing(`stages.${index}.resolution`)"
                @click="handleStorylineSync(`stages.${index}.resolution`)"
              >
                ⬆同步
              </NButton>
            </template>
            同步到提示词文件 (storyline-chapter1-refs.ts → chapter{{ index + 1 }}Resolution)
          </NTooltip>
          <span
            v-if="worldStore.getFieldMeta('mainStoryline', `stages.${index}.resolution`).finalizedBy"
            class="finalized-tag"
            :class="worldStore.getFieldMeta('mainStoryline', `stages.${index}.resolution`).finalizedBy === 'yongge' ? 'client' : 'admin'"
          >
            {{ worldStore.getFieldMeta('mainStoryline', `stages.${index}.resolution`).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
          </span>
        </div>
        <CollabTextField v-model="stage.resolution" :base-content="worldStore.getFieldMeta('mainStoryline', `stages.${index}.resolution`).baseContent || ''" :last-edit-by="worldStore.getFieldMeta('mainStoryline', `stages.${index}.resolution`).lastEditBy || ''" placeholder="这个章节如何收尾，如何过渡到下一章节..." :autosize="{ minRows: 3, maxRows: 30 }" :maxlength="20000" show-count :disabled="isFinalized(`stages.${index}.resolution`)" show-expand-button :field-label="`第${index+1}章节 结局过渡`" @input="onFieldInput(`stages.${index}.resolution`)" />
      </div>
    </div>

    <!-- 生成范围选择器 -->
    <div class="generation-scope-selector">
      <span class="scope-label">生成范围：</span>
      <button
        v-for="item in scopeOptions"
        :key="item.value"
        :class="['scope-btn', { active: generationScope === item.value }]"
        @click="generationScope = item.value"
      >
        {{ item.label }}
      </button>
    </div>
    <div v-if="scopeWarning" class="scope-warning">
      ⚠️ {{ scopeWarning }}
    </div>

    <AIPanel
      :module-id="currentModuleId"
      :context-labels="['三界结构']"
      :check-field-conflicts="checkFieldConflicts"
      :extra-context="extraContext"
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
  margin-bottom: 10px;
  padding: 10px 12px;
  background: var(--color-bg-secondary, #1a1410);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, rgba(212, 168, 83, 0.22));
}

.scope-label {
  font-size: 13px;
  color: var(--color-text-secondary, #a0a8c0);
  white-space: nowrap;
}

.scope-btn {
  padding: 5px 14px;
  font-size: 13px;
  border: 1px solid var(--color-border, rgba(255,255,255,0.12));
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: var(--color-text-secondary, #a0a8c0);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scope-btn:hover {
  border-color: var(--color-primary, #d4a853);
  color: var(--color-primary, #d4a853);
}

.scope-btn.active {
  background: var(--color-primary, #d4a853);
  border-color: var(--color-primary, #d4a853);
  color: #000;
  font-weight: 600;
}

.scope-warning {
  font-size: 12px;
  color: var(--color-warning, #e6a23c);
  margin-bottom: 8px;
  padding: 6px 10px;
  background: rgba(230, 162, 60, 0.08);
  border-radius: var(--radius-sm, 6px);
  border: 1px solid rgba(230, 162, 60, 0.2);
}
</style>
