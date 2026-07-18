<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, NInput, NProgress, NTag, NTooltip, useMessage } from 'naive-ui'
import { CONTINENT_MAP } from '@/constants/continents'
import { parseKeyValueBlock, parseSections } from '@/services/ai-content-parser'
import { syncModuleReferenceBatch } from '@/services/data-api'
import { useLandingStore } from '@/stores/landing'
import type { LandingAct, LandingContinentId } from '@/types/landing'
import AIPanel from '@/components/shared/AIPanel.vue'

const props = defineProps<{ continentId?: string }>()
const route = useRoute()
const message = useMessage()
const landingStore = useLandingStore()
const syncingSections = ref<Set<string>>(new Set())

const cId = computed(() => (props.continentId || route.params.continentId) as LandingContinentId)
const meta = computed(() => CONTINENT_MAP[cId.value])
const data = computed(() => landingStore.state[cId.value])

const ACT_META: Record<LandingAct, { title: string; subtitle: string }> = {
  1: { title: '第一幕', subtitle: '踏入与定向' },
  2: { title: '第二幕', subtitle: '真相与反转' },
  3: { title: '第三幕', subtitle: '代价与余波' }
}

const acts = computed(() => ([1, 2, 3] as LandingAct[]).map(act => ({
  act,
  ...ACT_META[act],
  nodes: data.value.levelNodes.slice((act - 1) * 3, act * 3),
  boss: data.value.bosses[act - 1]
})))

function isFinalized(fieldPath: string): boolean {
  return landingStore.isFieldFinalized(cId.value, fieldPath)
}

function toggleFinalize(fieldPath: string) {
  if (isFinalized(fieldPath)) landingStore.unfinalizeField(cId.value, fieldPath)
  else landingStore.finalizeField(cId.value, fieldPath)
}

function onFieldInput(fieldPath: string) {
  landingStore.updateFieldEditMeta(cId.value, fieldPath, 'user')
}

function copyStatus(value: string) {
  const length = Array.from(value.trim()).length
  if (length === 0) return { label: '未填写', type: 'default' as const }
  if (length < 20) return { label: `还差 ${20 - length} 字`, type: 'warning' as const }
  if (length <= 40) return { label: '长度合格', type: 'success' as const }
  return { label: `超出 ${length - 40} 字`, type: 'error' as const }
}

function getActCompletion(act: LandingAct): number {
  const actIndex = act - 1
  const boss = data.value.bosses[actIndex]
  const nodes = data.value.levelNodes.slice(actIndex * 3, actIndex * 3 + 3)
  const values = [
    data.value.systemDialogue.actNodes[actIndex],
    boss.name,
    boss.identity,
    boss.motivation,
    boss.signatureLine,
    ...nodes.flatMap(node => [node.storyPurpose, node.entryPrompt, node.completionFeedback, node.narrativeReward])
  ]
  return Math.round((values.filter(value => value.trim()).length / values.length) * 100)
}

function applyAIField(fieldPath: string, value: string | undefined, setter: (value: string) => void): boolean {
  if (!value?.trim()) return false
  if (isFinalized(fieldPath)) return false
  setter(value.trim())
  landingStore.updateFieldEditMeta(cId.value, fieldPath, 'ai')
  return true
}

function handleAcceptSystemDialogue(content: string) {
  const sections = parseSections(content)
  const keys = ['开场对白', '第一幕节点', '第二幕节点', '第三幕节点']
  if (!keys.some(key => sections[key]?.trim())) {
    message.error('AI 输出缺少系统对白标记，未写入任何字段')
    return
  }

  let applied = 0
  if (applyAIField('systemDialogue.opening', sections['开场对白'], value => { data.value.systemDialogue.opening = value })) applied++
  for (let index = 0; index < 3; index++) {
    const fieldPath = `systemDialogue.actNodes.${index}`
    if (applyAIField(fieldPath, sections[keys[index + 1]], value => { data.value.systemDialogue.actNodes[index] = value })) applied++
  }
  message.success(`已写入 ${applied} 条系统对白，定稿字段保持不变`)
}

const bossFieldLabels: Record<string, string[]> = {
  name: ['名字', '名称', 'Boss名称'],
  identity: ['身份', '身份背景', '背景'],
  motivation: ['动机', '目的'],
  signatureLine: ['一句话台词', '标志性台词', '台词']
}

function handleAcceptBosses(content: string) {
  const entries = Object.entries(parseSections(content)).filter(([title]) => /^Boss\d/.test(title))
  if (entries.length !== 3) {
    message.error(`AI 输出应包含 3 名 Boss，当前识别到 ${entries.length} 名，未写入`)
    return
  }

  let applied = 0
  entries.forEach(([, block], index) => {
    const parsed = parseKeyValueBlock(block, bossFieldLabels)
    const boss = data.value.bosses[index]
    ;(['name', 'identity', 'motivation', 'signatureLine'] as const).forEach(field => {
      const fieldPath = `bosses.${index}.${field}`
      if (applyAIField(fieldPath, parsed[field], value => { boss[field] = value })) applied++
    })
  })
  message.success(`已写入 ${applied} 个 Boss 字段，定稿字段保持不变`)
}

const regionFieldLabels: Record<string, string[]> = {
  name: ['名称', '区域名称', '名字'],
  storyPurpose: ['叙事任务', '故事目标', '叙事目标'],
  entryPrompt: ['进入前提示', '进入提示'],
  completionFeedback: ['结束后反馈', '结束反馈'],
  narrativeReward: ['叙事线索', '叙事奖励', '剧情线索']
}

function handleAcceptRegions(content: string) {
  const entries = Object.entries(parseSections(content)).filter(([title]) => /^区域\d/.test(title))
  if (entries.length !== 9) {
    message.error(`AI 输出应包含 9 个区域，当前识别到 ${entries.length} 个，未写入`)
    return
  }

  let applied = 0
  entries.forEach(([, block], index) => {
    const parsed = parseKeyValueBlock(block, regionFieldLabels)
    const node = data.value.levelNodes[index]
    ;(['name', 'storyPurpose', 'entryPrompt', 'completionFeedback', 'narrativeReward'] as const).forEach(field => {
      const fieldPath = `levelNodes.${index}.${field}`
      if (applyAIField(fieldPath, parsed[field], value => { node[field] = value })) applied++
    })
  })
  message.success(`已写入 ${applied} 个区域字段，定稿字段保持不变`)
}

function sectionSyncing(section: string): boolean {
  return syncingSections.value.has(section)
}

function setSectionSyncing(section: string, syncing: boolean) {
  if (syncing) syncingSections.value.add(section)
  else syncingSections.value.delete(section)
  syncingSections.value = new Set(syncingSections.value)
}

function formatSystemDialogue(): string {
  return [
    `【开场对白】\n${data.value.systemDialogue.opening}`,
    ...data.value.systemDialogue.actNodes.map((dialogue, index) => `【第${index + 1}幕节点】\n${dialogue}`)
  ].filter(block => block.replace(/【.*?】/g, '').trim()).join('\n\n')
}

function formatBosses(): string {
  return data.value.bosses.map((boss, index) => [
    `【Boss${index + 1}·第${boss.areaIndex}区域】`,
    `名字：${boss.name}`,
    `身份：${boss.identity}`,
    `动机：${boss.motivation}`,
    `一句话台词：${boss.signatureLine}`
  ].join('\n')).join('\n\n')
}

function formatLevelNodes(): string {
  return data.value.levelNodes.map((node, index) => [
    `【区域${index + 1}】`,
    `名称：${node.name}`,
    `叙事任务：${node.storyPurpose}`,
    `进入前提示：${node.entryPrompt}`,
    `结束后反馈：${node.completionFeedback}`,
    `叙事线索：${node.narrativeReward}`
  ].join('\n')).join('\n\n')
}

async function syncLandingSection(section: 'systemDialogue' | 'bosses' | 'levelNodes') {
  const formatter = {
    systemDialogue: formatSystemDialogue,
    bosses: formatBosses,
    levelNodes: formatLevelNodes
  }[section]
  const content = formatter().trim()
  if (!content) {
    message.warning('当前模块内容为空，无法同步')
    return
  }

  setSectionSyncing(section, true)
  try {
    await syncModuleReferenceBatch('phase3Landing', { [`${cId.value}_${section}`]: content })
    message.success('已同步到阶段三提示词参考文件')
  } catch (error: any) {
    message.error(error?.message || '同步失败')
  } finally {
    setSectionSyncing(section, false)
  }
}
</script>

<template>
  <div v-if="meta && data" class="landing-workbench" :style="{ '--continent-accent': meta.color }">
    <header class="workbench-heading">
      <div class="heading-copy">
        <div class="heading-kicker">CHAPTER III / {{ meta.element }} ELEMENT</div>
        <h2>{{ meta.name }}落地文案</h2>
        <p>三幕九区沿同一条因果链推进，区域短句、Boss立场与系统对白在同一工作面定稿。</p>
      </div>
      <div class="completion-block">
        <div class="completion-value">{{ landingStore.getContinentCompletion(cId) }}%</div>
        <div class="completion-label">文案完成度</div>
        <NProgress
          type="line"
          :percentage="landingStore.getContinentCompletion(cId)"
          :show-indicator="false"
          :height="4"
          :color="meta.color"
          rail-color="rgba(255,255,255,0.08)"
        />
      </div>
    </header>

    <div class="scope-toolbar" aria-label="阶段三交付范围">
      <span class="scope-title">落地文案总览</span>
      <div class="scope-metrics">
        <span>3 幕</span>
        <span>9 区域</span>
        <span>3 Boss</span>
        <span>40 字内短句</span>
      </div>
    </div>

    <section class="workbench-section dialogue-section">
      <div class="section-heading">
        <div>
          <span class="section-index">01</span>
          <h3>少量系统对白</h3>
        </div>
        <NButton size="small" quaternary :loading="sectionSyncing('systemDialogue')" @click="syncLandingSection('systemDialogue')">
          同步参考稿
        </NButton>
      </div>

      <div class="dialogue-grid">
        <div class="copy-field copy-field-wide">
          <div class="copy-field-heading">
            <label>大陆开场</label>
            <NTag size="small" :type="copyStatus(data.systemDialogue.opening).type">
              {{ copyStatus(data.systemDialogue.opening).label }}
            </NTag>
          </div>
          <NInput
            v-model:value="data.systemDialogue.opening"
            type="textarea"
            placeholder="玩家首次进入大陆时显示的一句话"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :maxlength="40"
            show-count
            :disabled="isFinalized('systemDialogue.opening')"
            @update:value="onFieldInput('systemDialogue.opening')"
          />
        </div>
        <div v-for="act in ([1, 2, 3] as LandingAct[])" :key="act" class="copy-field">
          <div class="copy-field-heading">
            <label>第{{ act }}幕阶段节点</label>
            <NTag size="small" :type="copyStatus(data.systemDialogue.actNodes[act - 1]).type">
              {{ copyStatus(data.systemDialogue.actNodes[act - 1]).label }}
            </NTag>
          </div>
          <NInput
            v-model:value="data.systemDialogue.actNodes[act - 1]"
            type="textarea"
            :placeholder="`完成第${act * 3}区域后显示的一句话`"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :maxlength="40"
            show-count
            :disabled="isFinalized(`systemDialogue.actNodes.${act - 1}`)"
            @update:value="onFieldInput(`systemDialogue.actNodes.${act - 1}`)"
          />
        </div>
      </div>

      <AIPanel
        :module-id="`phase3-${cId}-system-dialogue`"
        :context-labels="['阶段一摘要', `${meta.name}阶段二叙事`]"
        @accept="handleAcceptSystemDialogue"
      />
    </section>

    <section class="workbench-section region-section">
      <div class="section-heading">
        <div>
          <span class="section-index">02</span>
          <h3>三幕九区域</h3>
        </div>
        <div class="section-actions">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton size="small" quaternary :loading="sectionSyncing('levelNodes')" @click="syncLandingSection('levelNodes')">
                同步区域稿
              </NButton>
            </template>
            同步区域文案到 AI 参考文件
          </NTooltip>
          <NButton size="small" quaternary :loading="sectionSyncing('bosses')" @click="syncLandingSection('bosses')">
            同步 Boss 稿
          </NButton>
        </div>
      </div>

      <div v-for="actGroup in acts" :key="actGroup.act" class="act-section">
        <div class="act-heading">
          <div class="act-number">0{{ actGroup.act }}</div>
          <div class="act-title">
            <h4>{{ actGroup.title }}</h4>
            <span>{{ actGroup.subtitle }} · 区域 {{ (actGroup.act - 1) * 3 + 1 }}—{{ actGroup.act * 3 }}</span>
          </div>
          <div class="act-progress">
            <span>{{ getActCompletion(actGroup.act) }}%</span>
            <NProgress
              type="line"
              :percentage="getActCompletion(actGroup.act)"
              :show-indicator="false"
              :height="3"
              :color="meta.color"
              rail-color="rgba(255,255,255,0.07)"
            />
          </div>
        </div>

        <div class="region-list">
          <article
            v-for="(node, localIndex) in actGroup.nodes"
            :key="(actGroup.act - 1) * 3 + localIndex"
            class="region-record"
            :class="{ 'boss-region': localIndex === 2 }"
          >
            <div class="region-identity">
              <span class="region-order">区域 {{ (actGroup.act - 1) * 3 + localIndex + 1 }}</span>
              <NInput
                v-model:value="node.name"
                size="large"
                placeholder="区域名称"
                :maxlength="24"
                @update:value="onFieldInput(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.name`)"
              />
              <NButton
                size="tiny"
                quaternary
                :type="isFinalized(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.storyPurpose`) ? 'warning' : 'default'"
                @click="toggleFinalize(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.storyPurpose`)"
              >
                {{ isFinalized(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.storyPurpose`) ? '已定稿' : '定稿' }}
              </NButton>
            </div>

            <div class="region-edit-grid">
              <div class="field-block narrative-field">
                <label>叙事任务</label>
                <NInput
                  v-model:value="node.storyPurpose"
                  type="textarea"
                  placeholder="玩家在此发现、确认或改变什么"
                  :autosize="{ minRows: 3, maxRows: 8 }"
                  :maxlength="600"
                  show-count
                  :disabled="isFinalized(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.storyPurpose`)"
                  @update:value="onFieldInput(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.storyPurpose`)"
                />
              </div>
              <div class="field-block narrative-field">
                <label>叙事线索</label>
                <NInput
                  v-model:value="node.narrativeReward"
                  type="textarea"
                  placeholder="完成区域后获得的真相、证词或下一步线索"
                  :autosize="{ minRows: 3, maxRows: 8 }"
                  :maxlength="400"
                  show-count
                  @update:value="onFieldInput(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.narrativeReward`)"
                />
              </div>
              <div class="field-block copy-block">
                <div class="copy-field-heading">
                  <label>进入前提示</label>
                  <NTag size="small" :type="copyStatus(node.entryPrompt).type">{{ copyStatus(node.entryPrompt).label }}</NTag>
                </div>
                <NInput
                  v-model:value="node.entryPrompt"
                  type="textarea"
                  placeholder="进入该区域前显示的一句话"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  :maxlength="40"
                  show-count
                  :disabled="isFinalized(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.entryPrompt`)"
                  @update:value="onFieldInput(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.entryPrompt`)"
                />
              </div>
              <div class="field-block copy-block">
                <div class="copy-field-heading">
                  <label>结束后反馈</label>
                  <NTag size="small" :type="copyStatus(node.completionFeedback).type">{{ copyStatus(node.completionFeedback).label }}</NTag>
                </div>
                <NInput
                  v-model:value="node.completionFeedback"
                  type="textarea"
                  placeholder="结束该区域后显示的一句话"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  :maxlength="40"
                  show-count
                  :disabled="isFinalized(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.completionFeedback`)"
                  @update:value="onFieldInput(`levelNodes.${(actGroup.act - 1) * 3 + localIndex}.completionFeedback`)"
                />
              </div>
            </div>

            <div v-if="localIndex === 2" class="boss-strip">
              <div class="boss-heading">
                <span class="boss-marker">BOSS / 区域 {{ actGroup.boss.areaIndex }}</span>
                <strong>{{ actGroup.boss.name || `第${actGroup.act}幕 Boss` }}</strong>
              </div>
              <div class="boss-grid">
                <div class="field-block boss-name-field">
                  <label>Boss 名称</label>
                  <NInput
                    v-model:value="actGroup.boss.name"
                    size="large"
                    placeholder="Boss 名称"
                    :maxlength="30"
                    @update:value="onFieldInput(`bosses.${actGroup.act - 1}.name`)"
                  />
                </div>
                <div class="field-block">
                  <label>身份</label>
                  <NInput
                    v-model:value="actGroup.boss.identity"
                    type="textarea"
                    placeholder="身份、阵营及与英雄的叙事关系"
                    :autosize="{ minRows: 3, maxRows: 8 }"
                    :maxlength="800"
                    show-count
                    @update:value="onFieldInput(`bosses.${actGroup.act - 1}.identity`)"
                  />
                </div>
                <div class="field-block">
                  <label>动机</label>
                  <NInput
                    v-model:value="actGroup.boss.motivation"
                    type="textarea"
                    placeholder="它真正想守护、夺取或掩盖什么"
                    :autosize="{ minRows: 3, maxRows: 8 }"
                    :maxlength="800"
                    show-count
                    @update:value="onFieldInput(`bosses.${actGroup.act - 1}.motivation`)"
                  />
                </div>
                <div class="field-block boss-line-field">
                  <div class="copy-field-heading">
                    <label>一句话台词</label>
                    <NTag size="small" :type="copyStatus(actGroup.boss.signatureLine).type">
                      {{ copyStatus(actGroup.boss.signatureLine).label }}
                    </NTag>
                  </div>
                  <NInput
                    v-model:value="actGroup.boss.signatureLine"
                    type="textarea"
                    placeholder="体现 Boss 立场与动机的一句话"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :maxlength="40"
                    show-count
                    :disabled="isFinalized(`bosses.${actGroup.act - 1}.signatureLine`)"
                    @update:value="onFieldInput(`bosses.${actGroup.act - 1}.signatureLine`)"
                  />
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="ai-workflow-grid">
        <AIPanel
          :module-id="`phase3-${cId}-region-copy`"
          :context-labels="['阶段一摘要', `${meta.name}阶段二叙事`, '三名Boss']"
          @accept="handleAcceptRegions"
        />
        <AIPanel
          :module-id="`phase3-${cId}-boss-design`"
          :context-labels="['阶段一摘要', `${meta.name}阶段二叙事`]"
          @accept="handleAcceptBosses"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing-workbench {
  width: min(100%, 1480px);
  margin: 0 auto;
  padding: 26px 30px 64px;
  color: var(--color-text-primary);
  box-sizing: border-box;
}

.workbench-heading,
.scope-toolbar,
.section-heading,
.act-heading,
.region-identity,
.copy-field-heading,
.boss-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.workbench-heading {
  align-items: flex-end;
  gap: 32px;
  padding: 10px 0 24px;
  border-bottom: 1px solid rgba(236, 204, 142, 0.16);
}

.heading-copy {
  min-width: 0;
}

.heading-kicker,
.section-index,
.boss-marker,
.region-order,
.scope-title {
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0;
  color: var(--continent-accent);
  font-weight: 700;
}

.workbench-heading h2 {
  margin: 7px 0 8px;
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0;
  color: #f0dfb8;
}

.workbench-heading p {
  margin: 0;
  color: rgba(225, 218, 203, 0.62);
  font-size: 14px;
  line-height: 1.7;
}

.completion-block {
  width: 170px;
  flex: 0 0 170px;
  text-align: right;
}

.completion-value {
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1;
  color: #f0dfb8;
}

.completion-label {
  margin: 7px 0 10px;
  font-size: 12px;
  color: rgba(225, 218, 203, 0.52);
}

.scope-toolbar {
  position: sticky;
  top: 0;
  z-index: 8;
  min-height: 48px;
  margin: 0 -30px;
  padding: 0 30px;
  background: rgba(10, 11, 11, 0.96);
  border-bottom: 1px solid rgba(236, 204, 142, 0.12);
  backdrop-filter: blur(14px);
}

.scope-metrics,
.section-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.scope-metrics {
  color: rgba(225, 218, 203, 0.5);
  font-size: 12px;
}

.scope-metrics span + span::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 3px;
  margin: 0 18px 2px 0;
  background: var(--continent-accent);
}

.workbench-section {
  padding: 34px 0 10px;
}

.region-section {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.section-heading {
  min-height: 40px;
  margin-bottom: 18px;
}

.section-heading > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.section-heading h3,
.act-title h4 {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: 0;
  color: #ead9b5;
}

.section-heading h3 {
  font-size: 20px;
}

.dialogue-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.copy-field,
.region-record {
  border: 1px solid rgba(236, 204, 142, 0.12);
  border-radius: 6px;
  background: #101212;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
}

.copy-field {
  padding: 14px;
}

.copy-field-wide {
  grid-column: span 3;
}

.copy-field-heading {
  margin-bottom: 8px;
}

.copy-field label,
.field-block label {
  display: block;
  margin: 0 0 7px;
  font-size: 12px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: 0;
  color: rgba(235, 225, 205, 0.76);
}

.act-section {
  padding: 24px 0 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.act-heading {
  margin-bottom: 16px;
}

.act-number {
  width: 42px;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--continent-accent);
}

.act-title {
  flex: 1;
}

.act-title h4 {
  font-size: 17px;
}

.act-title span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: rgba(225, 218, 203, 0.46);
}

.act-progress {
  width: 140px;
  text-align: right;
  font-size: 11px;
  color: rgba(225, 218, 203, 0.5);
}

.act-progress span {
  display: block;
  margin-bottom: 5px;
}

.region-list {
  display: grid;
  gap: 12px;
}

.region-record {
  padding: 16px;
}

.region-record.boss-region {
  border-color: color-mix(in srgb, var(--continent-accent) 34%, rgba(236, 204, 142, 0.12));
}

.region-identity {
  display: grid;
  grid-template-columns: 76px minmax(200px, 360px) 1fr;
  justify-content: start;
  margin-bottom: 14px;
}

.region-identity .n-button {
  justify-self: end;
}

.region-edit-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.field-block {
  min-width: 0;
}

.copy-block {
  padding-left: 12px;
  border-left: 1px solid rgba(236, 204, 142, 0.09);
}

.boss-strip {
  margin: 16px -16px -16px;
  padding: 16px;
  border-top: 1px solid color-mix(in srgb, var(--continent-accent) 35%, transparent);
  background: #121210;
}

.boss-heading {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.boss-heading strong {
  color: #ead9b5;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
}

.boss-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.boss-line-field {
  grid-column: 2 / 4;
}

.ai-workflow-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding-top: 10px;
}

@media (max-width: 1180px) {
  .region-edit-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .copy-block {
    padding: 12px 0 0;
    border-top: 1px solid rgba(236, 204, 142, 0.09);
    border-left: 0;
  }

  .boss-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .boss-name-field {
    grid-column: span 2;
  }

  .boss-line-field {
    grid-column: span 2;
  }
}

@media (max-width: 860px) {
  .landing-workbench {
    padding: 18px 16px 48px;
  }

  .workbench-heading {
    align-items: flex-start;
  }

  .completion-block {
    width: 120px;
    flex-basis: 120px;
  }

  .scope-toolbar {
    position: static;
    margin: 0 -16px;
    padding: 0 16px;
  }

  .scope-metrics {
    display: none;
  }

  .dialogue-grid,
  .region-edit-grid,
  .boss-grid,
  .ai-workflow-grid {
    grid-template-columns: 1fr;
  }

  .copy-field-wide,
  .boss-name-field,
  .boss-line-field {
    grid-column: auto;
  }

  .region-identity {
    grid-template-columns: 70px minmax(0, 1fr);
  }

  .region-identity .n-button {
    grid-column: 2;
    justify-self: start;
  }

  .copy-block {
    padding: 12px 0 0;
  }
}

@media (max-width: 560px) {
  .workbench-heading {
    display: block;
  }

  .completion-block {
    width: 100%;
    margin-top: 18px;
    text-align: left;
  }

  .section-heading {
    align-items: flex-start;
  }

  .section-actions {
    gap: 4px;
  }

  .act-progress {
    width: 90px;
  }

  .region-identity {
    grid-template-columns: 1fr;
  }

  .region-identity .n-button {
    grid-column: auto;
  }
}
</style>
