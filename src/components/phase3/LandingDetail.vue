<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NInput, NButton, NSpace, NDivider, NTooltip, useMessage } from 'naive-ui'
import { useLandingStore } from '@/stores/landing'
import { CONTINENT_MAP } from '@/constants/continents'
import type { LandingContinentId } from '@/types/landing'
import AIPanel from '@/components/shared/AIPanel.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections, parseKeyValueBlock } from '@/services/ai-content-parser'
import { syncModuleReferenceBatch } from '@/services/data-api'

const props = defineProps<{ continentId?: string }>()
const route = useRoute()
const landingStore = useLandingStore()
const message = useMessage()
const syncingSections = ref<Set<string>>(new Set())

const cId = computed(() => (props.continentId || route.params.continentId) as LandingContinentId)
const meta = computed(() => CONTINENT_MAP[cId.value])
const data = computed(() => landingStore.state[cId.value])

function isFinalized(fieldPath: string): boolean {
  return landingStore.isFieldFinalized(cId.value, fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) {
    landingStore.unfinalizeField(cId.value, fieldPath)
  } else {
    landingStore.finalizeField(cId.value, fieldPath)
  }
}

function onFieldInput(fieldPath: string) {
  landingStore.updateFieldEditMeta(cId.value, fieldPath, 'user')
}

function finalizeAllEntry() {
  landingStore.finalizeModule(cId.value, ['entry.narrative', 'entry.npcDialogue', 'entry.atmosphere'])
}
function unfinalizeAllEntry() {
  for (const fp of ['entry.narrative', 'entry.npcDialogue', 'entry.atmosphere']) landingStore.unfinalizeField(cId.value, fp)
}
function finalizeAllCompletion() {
  landingStore.finalizeModule(cId.value, ['completion.narrative', 'completion.rewardStory', 'completion.transitionText'])
}
function unfinalizeAllCompletion() {
  for (const fp of ['completion.narrative', 'completion.rewardStory', 'completion.transitionText']) landingStore.unfinalizeField(cId.value, fp)
}

function handleAcceptEntry(content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])
  const d = data.value.entryPrompt
  if (sections['进入叙事'] && !skip.has('entry.narrative')) { d.narrative = sections['进入叙事']; landingStore.updateFieldEditMeta(cId.value, 'entry.narrative', 'ai') }
  if (sections['NPC对话'] && !skip.has('entry.npcDialogue')) { d.npcDialogue = sections['NPC对话']; landingStore.updateFieldEditMeta(cId.value, 'entry.npcDialogue', 'ai') }
  if (sections['氛围描述'] && !skip.has('entry.atmosphere')) { d.atmosphere = sections['氛围描述']; landingStore.updateFieldEditMeta(cId.value, 'entry.atmosphere', 'ai') }
  if (Object.keys(sections).length === 0 && content.trim() && !skip.has('entry.narrative')) {
    d.narrative = content
    landingStore.updateFieldEditMeta(cId.value, 'entry.narrative', 'ai')
  }
}

function handleAcceptCompletion(content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])
  const d = data.value.completionFeedback
  if (sections['通关叙事'] && !skip.has('completion.narrative')) { d.narrative = sections['通关叙事']; landingStore.updateFieldEditMeta(cId.value, 'completion.narrative', 'ai') }
  if (sections['奖励故事'] && !skip.has('completion.rewardStory')) { d.rewardStory = sections['奖励故事']; landingStore.updateFieldEditMeta(cId.value, 'completion.rewardStory', 'ai') }
  if (sections['过渡文本'] && !skip.has('completion.transitionText')) { d.transitionText = sections['过渡文本']; landingStore.updateFieldEditMeta(cId.value, 'completion.transitionText', 'ai') }
  if (Object.keys(sections).length === 0 && content.trim() && !skip.has('completion.narrative')) {
    d.narrative = content
    landingStore.updateFieldEditMeta(cId.value, 'completion.narrative', 'ai')
  }
}

const bossFieldLabels: Record<string, string[]> = {
  name: ['名字', '名称', 'Boss名称'],
  identity: ['身份背景', '身份', '背景'],
  motivation: ['动机', '目的'],
  signatureLine: ['标志性台词', '台词', '经典台词'],
  openingScene: ['开场设计', '开场', '出场设计'],
  storyConnection: ['核心冲突关系', '与核心冲突的关系', '冲突关系']
}

function handleAcceptBoss(content: string) {
  const sections = parseSections(content)
  const bosses = data.value.bosses

  if (Object.keys(sections).length === 0) {
    // 兜底：无标记则填入第一个 boss 的 identity
    if (bosses.length > 0 && content.trim()) {
      bosses[0].identity = content
    }
    return
  }

  const sectionEntries = Object.entries(sections)
  for (let i = 0; i < sectionEntries.length; i++) {
    const [, blockContent] = sectionEntries[i]

    // 确保 bosses 数组有足够的位置
    while (bosses.length <= i) {
      landingStore.addBoss(cId.value)
    }

    const parsed = parseKeyValueBlock(blockContent, bossFieldLabels)
    const boss = bosses[i]
    if (parsed.name) boss.name = parsed.name
    if (parsed.identity) boss.identity = parsed.identity
    if (parsed.motivation) boss.motivation = parsed.motivation
    if (parsed.signatureLine) boss.signatureLine = parsed.signatureLine
    if (parsed.openingScene) boss.openingScene = parsed.openingScene
    if (parsed.storyConnection) boss.storyConnection = parsed.storyConnection
  }
}

const levelFieldLabels: Record<string, string[]> = {
  name: ['名称', '区域名称', '名字'],
  storyBeat: ['故事节拍', '故事', '剧情'],
  keyEncounter: ['关键遭遇', '遭遇', '关键事件'],
  narrativeReward: ['叙事奖励', '奖励', '剧情奖励']
}

function handleAcceptLevels(content: string) {
  const sections = parseSections(content)
  const nodes = data.value.levelNodes

  if (Object.keys(sections).length === 0) {
    // 兜底
    if (nodes.length > 0 && content.trim()) {
      nodes[0].storyBeat = content
    }
    return
  }

  const sectionEntries = Object.entries(sections)
  for (let i = 0; i < sectionEntries.length && i < nodes.length; i++) {
    const [, blockContent] = sectionEntries[i]

    const parsed = parseKeyValueBlock(blockContent, levelFieldLabels)
    const node = nodes[i]
    if (parsed.name) node.name = parsed.name
    if (parsed.storyBeat) node.storyBeat = parsed.storyBeat
    if (parsed.keyEncounter) node.keyEncounter = parsed.keyEncounter
    if (parsed.narrativeReward) node.narrativeReward = parsed.narrativeReward
  }
}

function sectionSyncing(section: string): boolean {
  return syncingSections.value.has(section)
}

function setSectionSyncing(section: string, syncing: boolean) {
  if (syncing) {
    syncingSections.value.add(section)
  } else {
    syncingSections.value.delete(section)
  }
  syncingSections.value = new Set(syncingSections.value)
}

function formatEntryPrompt(): string {
  const d = data.value.entryPrompt
  return [
    `【进入叙事】\n${d.narrative || ''}`,
    `【NPC对话】\n${d.npcDialogue || ''}`,
    `【氛围描述】\n${d.atmosphere || ''}`
  ].filter(block => block.replace(/【.*?】/g, '').trim()).join('\n\n')
}

function formatCompletionFeedback(): string {
  const d = data.value.completionFeedback
  return [
    `【通关叙事】\n${d.narrative || ''}`,
    `【奖励故事】\n${d.rewardStory || ''}`,
    `【过渡文本】\n${d.transitionText || ''}`
  ].filter(block => block.replace(/【.*?】/g, '').trim()).join('\n\n')
}

function formatBosses(): string {
  return data.value.bosses
    .filter(boss => Object.values(boss).some(value => value.trim()))
    .map((boss, index) => [
      `【Boss${index + 1}】`,
      `名字：${boss.name || '（未填写）'}`,
      `身份背景：${boss.identity || '（未填写）'}`,
      `动机：${boss.motivation || '（未填写）'}`,
      `标志性台词：${boss.signatureLine || '（未填写）'}`,
      `开场设计：${boss.openingScene || '（未填写）'}`,
      `核心冲突关系：${boss.storyConnection || '（未填写）'}`
    ].join('\n'))
    .join('\n\n')
}

function formatLevelNodes(): string {
  return data.value.levelNodes
    .filter(node => Object.values(node).some(value => value.trim()))
    .map((node, index) => [
      `【区域${index + 1}】`,
      `名称：${node.name || '（未填写）'}`,
      `故事节拍：${node.storyBeat || '（未填写）'}`,
      `关键遭遇：${node.keyEncounter || '（未填写）'}`,
      `叙事奖励：${node.narrativeReward || '（未填写）'}`
    ].join('\n'))
    .join('\n\n')
}

async function syncLandingSection(section: 'entryPrompt' | 'completionFeedback' | 'bosses' | 'levelNodes') {
  const contentMap = {
    entryPrompt: formatEntryPrompt,
    completionFeedback: formatCompletionFeedback,
    bosses: formatBosses,
    levelNodes: formatLevelNodes
  }
  const content = contentMap[section]().trim()
  if (!content) {
    message.warning('当前模块内容为空，无法同步')
    return
  }
  setSectionSyncing(section, true)
  try {
    await syncModuleReferenceBatch('phase3Landing', { [`${cId.value}_${section}`]: content })
    message.success('已同步到提示词参考文件')
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    setSectionSyncing(section, false)
  }
}
</script>

<template>
  <div v-if="meta && data" class="content-section">
    <h2>
      <span :style="{ color: meta.color }">{{ meta.icon }}</span>
      {{ meta.name }} · 落地实现
    </h2>
    <p class="section-desc">设计该大陆的进入提示、通关反馈、Boss和关卡节点。</p>

    <!-- 进入提示 -->
    <section>
      <NDivider />
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">进入提示</h3>
        <NSpace :size="6">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" quaternary :loading="sectionSyncing('entryPrompt')" @click="syncLandingSection('entryPrompt')">⬆同步</NButton>
            </template>
            同步到提示词文件 (phase3-landing-refs.ts)
          </NTooltip>
          <NButton size="tiny" quaternary @click="finalizeAllEntry">全部定稿</NButton>
          <NButton size="tiny" quaternary @click="unfinalizeAllEntry">全部解锁</NButton>
        </NSpace>
      </div>

      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;"><label style="flex:1;">进入叙事</label>
          <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized('entry.narrative') ? 'warning' : 'default'" quaternary @click="toggleFinalize('entry.narrative')">{{ isFinalized('entry.narrative') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized('entry.narrative') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
        </div>
        <NInput
          v-model:value="data.entryPrompt.narrative"
          type="textarea"
          placeholder="玩家第一次踏入该大陆时的描述性文字..."
          :autosize="{ minRows: 3, maxRows: 30 }"
          :maxlength="3000"
          show-count
          :disabled="isFinalized('entry.narrative')"
          :style="isFinalized('entry.narrative') ? 'opacity: 0.7;' : ''"
          @input="onFieldInput('entry.narrative')"
        />
      </div>
      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;"><label style="flex:1;">NPC对话</label>
          <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized('entry.npcDialogue') ? 'warning' : 'default'" quaternary @click="toggleFinalize('entry.npcDialogue')">{{ isFinalized('entry.npcDialogue') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized('entry.npcDialogue') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
        </div>
        <NInput
          v-model:value="data.entryPrompt.npcDialogue"
          type="textarea"
          placeholder="女神或当地NPC在玩家进入时的引导对话..."
          :autosize="{ minRows: 3, maxRows: 20 }"
          :maxlength="3000"
          show-count
          :disabled="isFinalized('entry.npcDialogue')"
          :style="isFinalized('entry.npcDialogue') ? 'opacity: 0.7;' : ''"
          @input="onFieldInput('entry.npcDialogue')"
        />
      </div>
      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;"><label style="flex:1;">氛围描述</label>
          <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized('entry.atmosphere') ? 'warning' : 'default'" quaternary @click="toggleFinalize('entry.atmosphere')">{{ isFinalized('entry.atmosphere') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized('entry.atmosphere') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
        </div>
        <NInput
          v-model:value="data.entryPrompt.atmosphere"
          type="textarea"
          placeholder="该大陆的整体环境氛围、视觉和声音特征..."
          :autosize="{ minRows: 3, maxRows: 20 }"
          :maxlength="2000"
          show-count
          :disabled="isFinalized('entry.atmosphere')"
          :style="isFinalized('entry.atmosphere') ? 'opacity: 0.7;' : ''"
          @input="onFieldInput('entry.atmosphere')"
        />
      </div>

      <AIPanel
        :module-id="`phase3-${cId}-entry-prompt`"
        :context-labels="['阶段一摘要', `${meta.name}叙事设计`]"
        @accept="(c: string) => handleAcceptEntry(c)"
        @accept-partial="(c: string, skipped: string[]) => handleAcceptEntry(c, skipped)"
      />
    </section>

    <!-- 通关反馈 -->
    <section>
      <NDivider />
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">通关反馈</h3>
        <NSpace :size="6">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" quaternary :loading="sectionSyncing('completionFeedback')" @click="syncLandingSection('completionFeedback')">⬆同步</NButton>
            </template>
            同步到提示词文件 (phase3-landing-refs.ts)
          </NTooltip>
          <NButton size="tiny" quaternary @click="finalizeAllCompletion">全部定稿</NButton>
          <NButton size="tiny" quaternary @click="unfinalizeAllCompletion">全部解锁</NButton>
        </NSpace>
      </div>

      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;"><label style="flex:1;">通关叙事</label>
          <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized('completion.narrative') ? 'warning' : 'default'" quaternary @click="toggleFinalize('completion.narrative')">{{ isFinalized('completion.narrative') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized('completion.narrative') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
        </div>
        <NInput
          v-model:value="data.completionFeedback.narrative"
          type="textarea"
          placeholder="完成所有挑战后的剧情文字..."
          :autosize="{ minRows: 3, maxRows: 30 }"
          :maxlength="3000"
          show-count
          :disabled="isFinalized('completion.narrative')"
          :style="isFinalized('completion.narrative') ? 'opacity: 0.7;' : ''"
          @input="onFieldInput('completion.narrative')"
        />
      </div>
      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;"><label style="flex:1;">奖励故事</label>
          <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized('completion.rewardStory') ? 'warning' : 'default'" quaternary @click="toggleFinalize('completion.rewardStory')">{{ isFinalized('completion.rewardStory') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized('completion.rewardStory') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
        </div>
        <NInput
          v-model:value="data.completionFeedback.rewardStory"
          type="textarea"
          placeholder="获得封魂令的具体场景描述..."
          :autosize="{ minRows: 3, maxRows: 20 }"
          :maxlength="2000"
          show-count
          :disabled="isFinalized('completion.rewardStory')"
          :style="isFinalized('completion.rewardStory') ? 'opacity: 0.7;' : ''"
          @input="onFieldInput('completion.rewardStory')"
        />
      </div>
      <div class="field-group">
        <div style="display:flex;align-items:center;gap:6px;"><label style="flex:1;">过渡文本</label>
          <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized('completion.transitionText') ? 'warning' : 'default'" quaternary @click="toggleFinalize('completion.transitionText')">{{ isFinalized('completion.transitionText') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized('completion.transitionText') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
        </div>
        <NInput
          v-model:value="data.completionFeedback.transitionText"
          type="textarea"
          placeholder="引导前往下一大陆的叙事过渡..."
          :autosize="{ minRows: 3, maxRows: 20 }"
          :maxlength="2000"
          show-count
          :disabled="isFinalized('completion.transitionText')"
          :style="isFinalized('completion.transitionText') ? 'opacity: 0.7;' : ''"
          @input="onFieldInput('completion.transitionText')"
        />
      </div>

      <AIPanel
        :module-id="`phase3-${cId}-completion-feedback`"
        :context-labels="['阶段一摘要', `${meta.name}叙事设计`, '进入提示']"
        @accept="(c: string) => handleAcceptCompletion(c)"
        @accept-partial="(c: string, skipped: string[]) => handleAcceptCompletion(c, skipped)"
      />
    </section>

    <!-- Boss设计 -->
    <section>
      <NDivider />
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Boss设计</h3>
        <NSpace :size="6">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="tiny" quaternary :loading="sectionSyncing('bosses')" @click="syncLandingSection('bosses')">⬆同步</NButton>
            </template>
            同步到提示词文件 (phase3-landing-refs.ts)
          </NTooltip>
          <NButton size="small" @click="landingStore.addBoss(cId)">+ 添加Boss</NButton>
        </NSpace>
      </div>

      <div v-for="(boss, idx) in data.bosses" :key="idx" class="boss-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-weight:500;font-size:13px;">Boss #{{ idx + 1 }}</span>
          <NButton v-if="data.bosses.length > 1" size="tiny" quaternary type="error" @click="landingStore.removeBoss(cId, idx)">删除</NButton>
        </div>

        <div class="boss-fields">
          <div class="field-group">
            <label>名字</label>
            <NInput v-model:value="boss.name" placeholder="Boss名称" size="small" />
          </div>
          <div class="field-group">
            <label>身份背景</label>
            <NInput v-model:value="boss.identity" type="textarea" placeholder="是什么存在，来自哪里" size="small" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="2000" show-count />
          </div>
          <div class="field-group">
            <label>动机</label>
            <NInput v-model:value="boss.motivation" type="textarea" placeholder="为什么阻拦玩家" size="small" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="2000" show-count />
          </div>
          <div class="field-group">
            <label>标志性台词</label>
            <NInput v-model:value="boss.signatureLine" placeholder="一句经典台词" size="small" />
          </div>
          <div class="field-group">
            <label>开场设计</label>
            <NInput v-model:value="boss.openingScene" type="textarea" placeholder="Boss出现时的场景描述" size="small" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="2000" show-count />
          </div>
          <div class="field-group">
            <label>与核心冲突的关系</label>
            <NInput v-model:value="boss.storyConnection" type="textarea" placeholder="如何推动大陆的核心冲突" size="small" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="2000" show-count />
          </div>
        </div>
      </div>

      <AIPanel
        :module-id="`phase3-${cId}-boss-design`"
        :context-labels="['阶段一摘要', `${meta.name}叙事设计`]"
        @accept="handleAcceptBoss"
      />
    </section>

    <!-- 关卡节点 -->
    <section>
      <NDivider />
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;margin:0;">关卡节点（9个区域）</h3>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="sectionSyncing('levelNodes')" @click="syncLandingSection('levelNodes')">⬆同步</NButton>
          </template>
          同步到提示词文件 (phase3-landing-refs.ts)
        </NTooltip>
      </div>

      <div v-for="(node, idx) in data.levelNodes" :key="idx" class="level-node">
        <div class="node-header">
          <span class="node-number">{{ idx + 1 }}</span>
          <NInput
            v-model:value="node.name"
            :placeholder="`区域${idx + 1}名称`"
            size="small"
            style="flex:1;"
          />
        </div>
        <div class="node-fields">
          <div class="field-group">
            <label>故事节拍</label>
            <NInput v-model:value="node.storyBeat" type="textarea" placeholder="核心剧情事件" size="small" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="2000" show-count />
          </div>
          <div class="field-group">
            <label>关键遭遇</label>
            <NInput v-model:value="node.keyEncounter" type="textarea" placeholder="主要战斗或探索事件" size="small" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="2000" show-count />
          </div>
          <div class="field-group">
            <label>叙事奖励</label>
            <NInput v-model:value="node.narrativeReward" type="textarea" placeholder="通过后获得的剧情信息" size="small" :autosize="{ minRows: 1, maxRows: 10 }" :maxlength="1000" show-count />
          </div>
        </div>
      </div>

      <AIPanel
        :module-id="`phase3-${cId}-level-nodes`"
        :context-labels="['阶段一摘要', `${meta.name}叙事设计`, 'Boss设计']"
        @accept="handleAcceptLevels"
      />
    </section>
  </div>
</template>

<style scoped>
.boss-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 12px;
  background: var(--color-bg-card);
}

.boss-fields .field-group {
  margin-bottom: 8px;
}

.boss-fields .field-group label {
  font-size: 13px;
}

.level-node {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 10px;
  background: var(--color-bg-card);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.node-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent-gold);
  color: var(--color-bg-primary);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-fields .field-group {
  margin-bottom: 6px;
}

.node-fields .field-group label {
  font-size: 13px;
}
</style>
