<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NDivider, NButton, NTooltip, NSpace, useMessage } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import PptButton from '@/components/shared/PptButton.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections } from '@/services/ai-content-parser'
import { syncReference, syncModuleReference } from '@/services/data-api'

const worldStore = useWorldStore()
const s = worldStore.state.realmStructure
const message = useMessage()

/** 同步中的字段 key（用于 loading 状态） */
const syncingFields = ref<Set<string>>(new Set())

async function handleSync(realm: RealmKey, field: TimeKey) {
  const key = `${realm}.${field}`
  const content = (s as any)[realm]?.[field] ?? ''
  if (!content || !content.trim()) {
    message.warning('该字段内容为空，无法同步')
    return
  }
  syncingFields.value.add(key)
  try {
    await syncReference(realm, field, content)
    message.success('已同步到提示词文件')
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    syncingFields.value.delete(key)
    // 触发响应式更新
    syncingFields.value = new Set(syncingFields.value)
  }
}

function isSyncing(realm: RealmKey, field: TimeKey): boolean {
  return syncingFields.value.has(`${realm}.${field}`)
}

async function handleOverviewSync() {
  const content = s.summary || ''
  if (!content || !content.trim()) {
    message.warning('概述内容为空，无法同步')
    return
  }
  syncingFields.value.add('summary')
  try {
    await syncModuleReference('overview', 'content', content)
    message.success('已同步到提示词文件')
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    syncingFields.value.delete('summary')
    syncingFields.value = new Set(syncingFields.value)
  }
}

function isSummarySyncing(): boolean {
  return syncingFields.value.has('summary')
}

// types
type RealmKey = 'upper' | 'mortal' | 'abyss'

const realms: { key: RealmKey; label: string; desc: string }[] = [
  { key: 'upper', label: '上界 / 神殿', desc: '天空之上的圣域，神灵与秩序的象征' },
  { key: 'mortal', label: '凡界', desc: '九大元素大陆所在，生灵繁衍之地' },
  { key: 'abyss', label: '深渊', desc: '被封印的黑暗领域，怪物的源头' }
]

type TimeKey = 'past' | 'present' | 'future'

const timeLabels: Record<TimeKey, string> = {
  past: '过去（世界完整时期）',
  present: '现状（封印松动后）',
  future: '未来展望'
}

/** 所有字段路径 */
const allFieldPaths = [
  'summary',
  ...(['upper', 'mortal', 'abyss'] as const).flatMap(r =>
    (['past', 'present', 'future'] as const).map(t => `${r}.${t}`)
  )
]

function getFieldPath(realmKey: string, timeKey: string): string {
  return `${realmKey}.${timeKey}`
}

function isFinalized(fieldPath: string): boolean {
  return worldStore.isFieldFinalized('realmStructure', fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    worldStore.unfinalizeField('realmStructure', fieldPath)
  } else {
    worldStore.finalizeField('realmStructure', fieldPath)
  }
}

function finalizeAll() {
  worldStore.finalizeModule('realmStructure', allFieldPaths)
}

function unfinalizeAll() {
  for (const fp of allFieldPaths) {
    worldStore.unfinalizeField('realmStructure', fp)
  }
}

function onFieldInput(fieldPath: string) {
  worldStore.updateFieldEditMeta('realmStructure', fieldPath, 'user')
}

/** 获取三界某时期字段内容（模板中类型安全访问） */
function getRealmContent(realmKey: string, timeKey: string): string {
  return (s as any)[realmKey]?.[timeKey] ?? ''
}

/** 拼接字段完整显示标签 */
function getFieldFullLabel(realmLabel: string, timeLabel: string): string {
  return `${realmLabel} · ${timeLabel.split('（')[0]}`
}

/** 概述区域冲突检测 */
function checkFieldConflictsForOverview(): ConflictField[] {
  const conflicts: ConflictField[] = []
  const meta = worldStore.getFieldMeta('realmStructure', 'summary')
  if (meta.status === 'finalized' || meta.lastEditSource === 'user') {
    conflicts.push({ fieldPath: 'summary', label: '三界概述', meta })
  }
  return conflicts
}

/** 各界冲突检测 */
function checkFieldConflictsForRealm(realmKey: RealmKey): () => ConflictField[] {
  return () => {
    const conflicts: ConflictField[] = []
    for (const timeKey of (['past', 'present', 'future'] as const)) {
      const fp = `${realmKey}.${timeKey}`
      const meta = worldStore.getFieldMeta('realmStructure', fp)
      if (meta.status === 'finalized' || meta.lastEditSource === 'user') {
        conflicts.push({ fieldPath: fp, label: fp, meta })
      }
    }
    return conflicts
  }
}

/** 概述区域AI内容采纳 */
function handleAIAcceptOverview(content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])
  if (sections['三界概述'] && !skip.has('summary')) {
    s.summary = sections['三界概述']
    worldStore.updateFieldEditMeta('realmStructure', 'summary', 'ai')
  }
  if (Object.keys(sections).length === 0 && content.trim() && !skip.has('summary')) {
    s.summary = content
    worldStore.updateFieldEditMeta('realmStructure', 'summary', 'ai')
  }
}

/** 各界AI内容采纳 */
function handleAIAcceptRealm(realmKey: RealmKey, content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])
  const prefix = realmKey === 'upper' ? '上界' : realmKey === 'mortal' ? '凡界' : '深渊'

  for (const timeKey of (['past', 'present', 'future'] as const)) {
    const timeLabel = timeKey === 'past' ? '过去' : timeKey === 'present' ? '现状' : '未来'
    const sectionKey = `${prefix}-${timeLabel}`
    const fieldPath = `${realmKey}.${timeKey}`
    if (sections[sectionKey] && !skip.has(fieldPath)) {
      s[realmKey][timeKey] = sections[sectionKey]
      worldStore.updateFieldEditMeta('realmStructure', fieldPath, 'ai')
    }
  }

  if (Object.keys(sections).length === 0 && content.trim()) {
    for (const timeKey of (['past', 'present', 'future'] as const)) {
      const fieldPath = `${realmKey}.${timeKey}`
      if (!skip.has(fieldPath)) {
        s[realmKey][timeKey] = content
        worldStore.updateFieldEditMeta('realmStructure', fieldPath, 'ai')
        break
      }
    }
  }
}

/** 各时期对应的 PPT 文件名，没有则留空 */
const realmPptMap: Record<string, string> = {
  'upper.past': '魂域神界：上界·神殿.pdf',
  'upper.present': '魂域神界：上界·神殿.pdf',
  'upper.future': '魂域神界：上界·神殿.pdf',
  'mortal.past': '魂域凡界 · 过去 现在 未来.pdf',
  'mortal.present': '魂域凡界 · 过去 现在 未来.pdf',
  'mortal.future': '魂域凡界 · 过去 现在 未来.pdf',
  'abyss.past': '魂域深渊：根域的史诗.pdf',
  'abyss.present': '魂域深渊：根域的史诗.pdf',
  'abyss.future': '魂域深渊：根域的史诗.pdf',
}
</script>

<template>
  <div class="content-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <h2>三界结构优化</h2>
      <NSpace :size="6">
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">设计上界、凡界、深渊的过去、现状与未来，建立世界的基础框架。</p>

    <div class="field-group">
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="flex:1;">三界整体概述</label>
        <PptButton ppt-file="魂域的起源与三界的形成.pdf" />
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized('summary') ? 'warning' : 'default'" quaternary @click="toggleFinalize('summary')">
              {{ isFinalized('summary') ? '🔒' : '📝' }}
            </NButton>
          </template>
          {{ isFinalized('summary') ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
        <NTooltip v-if="isFinalized('summary')" trigger="hover">
          <template #trigger>
            <NButton
              size="tiny"
              quaternary
              type="primary"
              :loading="isSummarySyncing()"
              @click="handleOverviewSync"
            >
              ⬆同步
            </NButton>
          </template>
          同步到提示词文件 (src/services/prompts/references/overview-refs.ts)
        </NTooltip>
        <span
          v-if="worldStore.getFieldMeta('realmStructure', 'summary').finalizedBy"
          class="finalized-tag"
          :class="worldStore.getFieldMeta('realmStructure', 'summary').finalizedBy === 'yongge' ? 'client' : 'admin'"
        >
          {{ worldStore.getFieldMeta('realmStructure', 'summary').finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
        </span>
      </div>
      <CollabTextField
        v-model="s.summary"
        :base-content="worldStore.getFieldMeta('realmStructure', 'summary').baseContent || ''"
        :last-edit-by="worldStore.getFieldMeta('realmStructure', 'summary').lastEditBy || ''"
        placeholder="描述三界的整体格局、世界树的位置、三界之间的关系..."
        :autosize="{ minRows: 3, maxRows: 30 }"
        :maxlength="20000"
        show-count
        :disabled="isFinalized('summary')"
        show-expand-button
        field-label="三界整体概述"
        @input="onFieldInput('summary')"
      />

      <AIPanel
        module-id="realm-overview"
        :context-labels="[]"
        :check-field-conflicts="checkFieldConflictsForOverview"
        @accept="(c: string) => handleAIAcceptOverview(c)"
        @accept-partial="(c: string, skipped: string[]) => handleAIAcceptOverview(c, skipped)"
      />
    </div>

    <NDivider />

    <div v-for="realm in realms" :key="realm.key" style="margin-bottom:32px;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">{{ realm.label }}</h3>
      <p style="font-size:13px;color:var(--color-text-tertiary);margin-bottom:16px;">{{ realm.desc }}</p>

      <div v-for="(label, timeKey) in timeLabels" :key="timeKey" class="field-group">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="flex:1;">{{ label }}</label>
          <PptButton :ppt-file="realmPptMap[getFieldPath(realm.key, timeKey)]" />
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" :type="isFinalized(getFieldPath(realm.key, timeKey)) ? 'warning' : 'default'" quaternary @click="toggleFinalize(getFieldPath(realm.key, timeKey))">
                {{ isFinalized(getFieldPath(realm.key, timeKey)) ? '🔒' : '📝' }}
              </NButton>
            </template>
            {{ isFinalized(getFieldPath(realm.key, timeKey)) ? '点击解除定稿' : '点击定稿' }}
          </NTooltip>
          <NTooltip v-if="isFinalized(getFieldPath(realm.key, timeKey))" trigger="hover">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                type="primary"
                :loading="isSyncing(realm.key, timeKey as TimeKey)"
                @click="handleSync(realm.key, timeKey as TimeKey)"
              >
                ⬆同步
              </NButton>
            </template>
            同步到提示词文件 (src/services/prompts/references/{{ realm.key }}-realm-refs.ts)
          </NTooltip>
          <span
            v-if="worldStore.getFieldMeta('realmStructure', getFieldPath(realm.key, timeKey)).finalizedBy"
            class="finalized-tag"
            :class="worldStore.getFieldMeta('realmStructure', getFieldPath(realm.key, timeKey)).finalizedBy === 'yongge' ? 'client' : 'admin'"
          >
            {{ worldStore.getFieldMeta('realmStructure', getFieldPath(realm.key, timeKey)).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
          </span>
        </div>
        <CollabTextField
          v-model="s[realm.key][timeKey as TimeKey]"
          :base-content="worldStore.getFieldMeta('realmStructure', getFieldPath(realm.key, timeKey)).baseContent || ''"
          :last-edit-by="worldStore.getFieldMeta('realmStructure', getFieldPath(realm.key, timeKey)).lastEditBy || ''"
          :placeholder="`描述${realm.label}在${label.split('(')[0]}时期的状态...`"
          :autosize="{ minRows: 3, maxRows: 30 }"
          :maxlength="20000"
          show-count
          :disabled="isFinalized(getFieldPath(realm.key, timeKey))"
          show-expand-button
          :field-label="getFieldFullLabel(realm.label, label)"
          @input="onFieldInput(getFieldPath(realm.key, timeKey))"
        />
      </div>

      <AIPanel
        :module-id="`realm-${realm.key}`"
        :context-labels="[]"
        :check-field-conflicts="checkFieldConflictsForRealm(realm.key)"
        @accept="(c: string) => handleAIAcceptRealm(realm.key, c)"
        @accept-partial="(c: string, skipped: string[]) => handleAIAcceptRealm(realm.key, c, skipped)"
      />
    </div>
  </div>
</template>
