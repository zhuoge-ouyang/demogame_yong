<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NTooltip, NSpace, useMessage } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections } from '@/services/ai-content-parser'
import { syncModuleReferenceBatch } from '@/services/data-api'

const worldStore = useWorldStore()
const message = useMessage()
const s = worldStore.state.worldTreeSystem
const syncingModule = ref(false)

const fields = [
  { key: 'growthMechanism' as const, label: '成长阶段与机制', placeholder: '描述世界树如何从幼苗成长为参天巨树，各阶段的特征与触发条件...' },
  { key: 'resourceContribution' as const, label: '资源贡献方式', placeholder: '描述玩家如何贡献资源给世界树，资源类型与收集途径...' },
  { key: 'unlockedFeatures' as const, label: '成长解锁功能', placeholder: '描述世界树成长后解锁的新功能/玩法，如新区域、技能树、buff等...' },
  { key: 'fourthForce' as const, label: '第四势力形成', placeholder: '描述世界树如何成为独立于三界的第四势力，形成条件与意义...' },
  { key: 'runeConnection' as const, label: '符文关联', placeholder: '描述符文与世界树/九大元素的关联，符文系统的运作方式...' }
]

const sectionMapping: Record<string, keyof typeof s> = {
  '成长阶段与机制': 'growthMechanism',
  '资源贡献方式': 'resourceContribution',
  '成长解锁功能': 'unlockedFeatures',
  '第四势力形成': 'fourthForce',
  '符文关联': 'runeConnection'
}

const allFieldPaths = fields.map(f => f.key)

function isFinalized(fieldPath: string): boolean {
  return worldStore.isFieldFinalized('worldTreeSystem', fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    worldStore.unfinalizeField('worldTreeSystem', fieldPath)
  } else {
    worldStore.finalizeField('worldTreeSystem', fieldPath)
  }
}

function finalizeAll() {
  worldStore.finalizeModule('worldTreeSystem', allFieldPaths)
}

function unfinalizeAll() {
  for (const fp of allFieldPaths) {
    worldStore.unfinalizeField('worldTreeSystem', fp)
  }
}

function onFieldInput(fieldPath: string) {
  worldStore.updateFieldEditMeta('worldTreeSystem', fieldPath, 'user')
}

function checkFieldConflicts(): ConflictField[] {
  const conflicts: ConflictField[] = []
  for (const fp of allFieldPaths) {
    const meta = worldStore.getFieldMeta('worldTreeSystem', fp)
    if (meta.status === 'finalized' || meta.lastEditSource === 'user') {
      const field = fields.find(f => f.key === fp)
      conflicts.push({ fieldPath: fp, label: field?.label || fp, meta })
    }
  }
  return conflicts
}

function handleAIAccept(content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])

  for (const [sectionKey, fieldKey] of Object.entries(sectionMapping)) {
    if (sections[sectionKey] && !skip.has(fieldKey)) {
      s[fieldKey] = sections[sectionKey]
      worldStore.updateFieldEditMeta('worldTreeSystem', fieldKey, 'ai')
    }
  }

  if (Object.keys(sections).length === 0 && content.trim() && !skip.has('growthMechanism')) {
    s.growthMechanism = content
    worldStore.updateFieldEditMeta('worldTreeSystem', 'growthMechanism', 'ai')
  }
}

async function syncWorldTreeSystem() {
  const payload = Object.fromEntries(
    fields
      .map(field => [field.key, s[field.key]?.trim() || ''])
      .filter(([, value]) => value)
  )
  if (Object.keys(payload).length === 0) {
    message.warning('当前模块内容为空，无法同步')
    return
  }
  syncingModule.value = true
  try {
    await syncModuleReferenceBatch('worldTree', payload)
    message.success('世界树系统已同步到提示词参考文件')
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
      <h2>世界树系统</h2>
      <NSpace :size="6">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="syncingModule" @click="syncWorldTreeSystem">⬆同步</NButton>
          </template>
          同步到提示词文件 (world-tree-system-refs.ts)
        </NTooltip>
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">定义世界树的成长机制、资源循环、解锁功能与第四势力的形成过程。</p>

    <div v-for="field in fields" :key="field.key" class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">{{ field.label }}</label>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized(field.key) ? 'warning' : 'default'" quaternary @click="toggleFinalize(field.key)">
              {{ isFinalized(field.key) ? '🔒' : '📝' }}
            </NButton>
          </template>
          {{ isFinalized(field.key) ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
      </div>
      <CollabTextField
        v-model="s[field.key]"
        :base-content="worldStore.getFieldMeta('worldTreeSystem', field.key).baseContent || ''"
        :last-edit-by="worldStore.getFieldMeta('worldTreeSystem', field.key).lastEditBy || ''"
        :placeholder="field.placeholder"
        :autosize="{ minRows: 3, maxRows: 30 }"
        :maxlength="20000"
        show-count
        :disabled="isFinalized(field.key)"
        show-expand-button
        :field-label="field.label"
        @input="onFieldInput(field.key)"
      />
    </div>

    <AIPanel
      module-id="world-tree-system"
      :context-labels="['三界结构', '玩家身份', '主线目标']"
      :check-field-conflicts="checkFieldConflicts"
      @accept="(c: string) => handleAIAccept(c)"
      @accept-partial="(c: string, skipped: string[]) => handleAIAccept(c, skipped)"
    />
  </div>
</template>
