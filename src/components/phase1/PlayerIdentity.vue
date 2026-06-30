<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NButton, NTooltip, NSpace, useMessage } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections } from '@/services/ai-content-parser'
import { syncModuleReferenceBatch } from '@/services/data-api'

const worldStore = useWorldStore()
const message = useMessage()
const s = worldStore.state.playerIdentity
const syncingModule = ref(false)

const fields = [
  { key: 'origin' as const, label: '起源概念', placeholder: '玩家作为世界树节点的含义，如何诞生/觉醒...' },
  { key: 'initialPerception' as const, label: '初始认知', placeholder: '玩家一开始以为自己是什么身份...' },
  { key: 'revelationArc' as const, label: '揭示弧线', placeholder: '如何逐步发现真实身份，关键揭示时刻...' }
]

const sectionMapping: Record<string, keyof typeof s> = {
  '起源概念': 'origin',
  '初始认知': 'initialPerception',
  '揭示弧线': 'revelationArc'
}

const allFieldPaths = fields.map(f => f.key)

function isFinalized(fieldPath: string): boolean {
  return worldStore.isFieldFinalized('playerIdentity', fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    worldStore.unfinalizeField('playerIdentity', fieldPath)
  } else {
    worldStore.finalizeField('playerIdentity', fieldPath)
  }
}

function finalizeAll() {
  worldStore.finalizeModule('playerIdentity', allFieldPaths)
}

function unfinalizeAll() {
  for (const fp of allFieldPaths) {
    worldStore.unfinalizeField('playerIdentity', fp)
  }
}

function onFieldInput(fieldPath: string) {
  worldStore.updateFieldEditMeta('playerIdentity', fieldPath, 'user')
}

function checkFieldConflicts(): ConflictField[] {
  const conflicts: ConflictField[] = []
  for (const fp of allFieldPaths) {
    const meta = worldStore.getFieldMeta('playerIdentity', fp)
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
      worldStore.updateFieldEditMeta('playerIdentity', fieldKey, 'ai')
    }
  }

  if (Object.keys(sections).length === 0 && content.trim() && !skip.has('origin')) {
    s.origin = content
    worldStore.updateFieldEditMeta('playerIdentity', 'origin', 'ai')
  }
}

async function syncPlayerIdentity() {
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
    await syncModuleReferenceBatch('playerIdentity', payload)
    message.success('玩家身份已同步到提示词参考文件')
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
      <h2>玩家身份定义</h2>
      <NSpace :size="6">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="syncingModule" @click="syncPlayerIdentity">⬆同步</NButton>
          </template>
          同步到提示词文件 (player-identity-refs.ts)
        </NTooltip>
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">定义玩家作为世界树节点的身份设定、认知过程与揭示弧线。</p>

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
        <span
          v-if="worldStore.getFieldMeta('playerIdentity', field.key).finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('playerIdentity', field.key).finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('playerIdentity', field.key).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField
        v-model="s[field.key]"
        :base-content="worldStore.getFieldMeta('playerIdentity', field.key).baseContent || ''"
        :last-edit-by="worldStore.getFieldMeta('playerIdentity', field.key).lastEditBy || ''"
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
      module-id="player-identity"
      :context-labels="['三界结构', '主线目标']"
      :check-field-conflicts="checkFieldConflicts"
      @accept="(c: string) => handleAIAccept(c)"
      @accept-partial="(c: string, skipped: string[]) => handleAIAccept(c, skipped)"
    />
  </div>
</template>
