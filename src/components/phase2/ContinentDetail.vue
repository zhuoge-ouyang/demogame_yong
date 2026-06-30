<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NDivider, NTooltip, NSpace, useMessage } from 'naive-ui'
import { useContinentsStore } from '@/stores/continents'
import { CONTINENT_MAP } from '@/constants/continents'
import { ASPECT_KEYS, ASPECT_LABELS } from '@/types/continent'
import type { ContinentId, ContinentAspects } from '@/types/continent'
import AIPanel from '@/components/shared/AIPanel.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import { syncModuleReferenceBatch } from '@/services/data-api'

const props = defineProps<{ continentId?: string }>()
const route = useRoute()
const router = useRouter()
const continentsStore = useContinentsStore()
const message = useMessage()
const syncingModule = ref(false)

const cId = computed(() => (props.continentId || route.params.continentId) as ContinentId)
const meta = computed(() => CONTINENT_MAP[cId.value])
const continent = computed(() => continentsStore.state[cId.value])
const hiddenAspectKeys = new Set<keyof ContinentAspects>([
  'experiencePositioning',
  'inGameExpression',
  'themeExpression',
  'playerProgressionChanges'
])
const visibleAspectKeys = computed(() =>
  ASPECT_KEYS.filter(aspectKey => !hiddenAspectKeys.has(aspectKey))
)

function getAIModuleId(aspectKey: keyof ContinentAspects): string {
  return `phase2-${cId.value}-${aspectKey}`
}

function getContextLabels(aspectKey: keyof ContinentAspects): string[] {
  const labels = ['阶段一摘要']
  const idx = ASPECT_KEYS.indexOf(aspectKey)
  for (let i = 0; i < idx; i++) {
    if (continent.value?.aspects[ASPECT_KEYS[i]]?.trim()) {
      labels.push(ASPECT_LABELS[ASPECT_KEYS[i]])
    }
  }
  return labels
}

function isFinalized(aspectKey: string): boolean {
  return continentsStore.isFieldFinalized(cId.value, aspectKey)
}

function toggleFinalize(aspectKey: string) {
  if (isFinalized(aspectKey)) {
    continentsStore.unfinalizeField(cId.value, aspectKey)
  } else {
    continentsStore.finalizeField(cId.value, aspectKey)
  }
}

function finalizeAll() {
  continentsStore.finalizeModule(cId.value, [...visibleAspectKeys.value])
}

function unfinalizeAll() {
  for (const k of visibleAspectKeys.value) {
    continentsStore.unfinalizeField(cId.value, k)
  }
}

function onFieldInput(aspectKey: string) {
  continentsStore.updateFieldEditMeta(cId.value, aspectKey, 'user')
}

function updateAspect(aspectKey: keyof ContinentAspects, value: string) {
  continentsStore.updateAspect(cId.value, aspectKey, value)
  onFieldInput(aspectKey)
}

function checkFieldConflictsForAspect(aspectKey: keyof ContinentAspects): () => ConflictField[] {
  return () => {
    const conflicts: ConflictField[] = []
    const fieldMeta = continentsStore.getFieldMeta(cId.value, aspectKey)
    if (fieldMeta.status === 'finalized' || fieldMeta.lastEditSource === 'user') {
      conflicts.push({ fieldPath: aspectKey, label: ASPECT_LABELS[aspectKey], meta: fieldMeta })
    }
    return conflicts
  }
}

function handleAIAccept(aspectKey: keyof ContinentAspects, content: string, skippedFields?: string[]) {
  const skip = new Set(skippedFields || [])
  if (!skip.has(aspectKey)) {
    continentsStore.updateAspect(cId.value, aspectKey, content)
    continentsStore.updateFieldEditMeta(cId.value, aspectKey, 'ai')
  }
}

async function syncCurrentContinent() {
  const c = continent.value
  if (!c) return
  const payload: Record<string, string> = {}
  for (const aspectKey of visibleAspectKeys.value) {
    const value = c.aspects[aspectKey]?.trim()
    if (value) payload[`${cId.value}_${aspectKey}`] = value
  }
  if (Object.keys(payload).length === 0) {
    message.warning('当前大陆内容为空，无法同步')
    return
  }
  syncingModule.value = true
  try {
    await syncModuleReferenceBatch('phase2Continents', payload)
    message.success(`${meta.value?.name || '当前大陆'}已同步到提示词参考文件`)
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    syncingModule.value = false
  }
}
</script>

<template>
  <div v-if="meta && continent" class="content-section">
    <div class="continent-header">
      <NButton size="small" quaternary @click="router.push('/phase2')">
        &larr; 返回总览
      </NButton>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;">
      <h2>
        <span :style="{ color: meta.color }">{{ meta.icon }}</span>
        {{ meta.name }} · {{ meta.element }}元素大陆
      </h2>
      <NSpace :size="6">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="syncingModule" @click="syncCurrentContinent">⬆同步</NButton>
          </template>
          同步到提示词文件 (phase2-continent-refs.ts)
        </NTooltip>
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">{{ meta.description }}</p>

    <div v-for="aspectKey in visibleAspectKeys" :key="aspectKey" style="margin-bottom:32px;">
      <NDivider />
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <h3 style="font-size:15px;font-weight:600;flex:1;margin:0;">
          {{ ASPECT_LABELS[aspectKey] }}
        </h3>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" :type="isFinalized(aspectKey) ? 'warning' : 'default'" quaternary @click="toggleFinalize(aspectKey)">
              {{ isFinalized(aspectKey) ? '🔒' : '📝' }}
            </NButton>
          </template>
          {{ isFinalized(aspectKey) ? '点击解除定稿' : '点击定稿' }}
        </NTooltip>
      </div>

      <div class="field-group">
        <CollabTextField
          :model-value="continent.aspects[aspectKey]"
          :placeholder="`请填写${meta.name}的${ASPECT_LABELS[aspectKey]}...`"
          :autosize="{ minRows: 4, maxRows: 30 }"
          :maxlength="5000"
          show-count
          :disabled="isFinalized(aspectKey)"
          show-expand-button
          open-in-modal
          :preview-length="220"
          :field-label="`${meta.name} · ${ASPECT_LABELS[aspectKey]}`"
          :base-content="continentsStore.getFieldMeta(cId, aspectKey).baseContent || ''"
          :last-edit-by="continentsStore.getFieldMeta(cId, aspectKey).lastEditBy || ''"
          @update:model-value="(v: string) => updateAspect(aspectKey, v)"
        />
      </div>

      <AIPanel
        :module-id="getAIModuleId(aspectKey)"
        :context-labels="getContextLabels(aspectKey)"
        :check-field-conflicts="checkFieldConflictsForAspect(aspectKey)"
        @accept="(content: string) => handleAIAccept(aspectKey, content)"
        @accept-partial="(content: string, skipped: string[]) => handleAIAccept(aspectKey, content, skipped)"
      />
    </div>
  </div>
</template>

<style scoped>
.continent-header {
  margin-bottom: 8px;
}
</style>
