<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { NInput, NCollapse, NCollapseItem, NButton, NTooltip, NSpace, NModal, NScrollbar, useMessage } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import { CONTINENTS } from '@/constants/continents'
import AIPanel from '@/components/shared/AIPanel.vue'
import CollabTextField from '@/components/shared/CollabTextField.vue'
import FullTextEditModal from '@/components/shared/FullTextEditModal.vue'
import type { ConflictField } from '@/components/shared/AIPanel.vue'
import { parseSections, parseKeyValueBlock } from '@/services/ai-content-parser'
import { syncModuleReferenceBatch } from '@/services/data-api'

const worldStore = useWorldStore()
const message = useMessage()
const heroes = worldStore.state.heroSystem
const syncingModule = ref(false)

// MVP 英雄索引（金=0, 冰=2, 火=3）
const MVP_INDICES = new Set([0, 2, 3])
function isMvpHero(index: number): boolean {
  return MVP_INDICES.has(index)
}

// 文本详情弹窗状态（视觉描述/性格特征）
const showTextDetailModal = ref(false)
const textDetailField = ref<'visual' | 'personality'>('visual')
const textDetailHeroIndex = ref(-1)

const textDetailTitle = computed(() => textDetailField.value === 'visual' ? '视觉描述' : '性格特征')
const textDetailHero = computed(() => textDetailHeroIndex.value >= 0 ? heroes[textDetailHeroIndex.value] : null)
const textDetailFieldPath = computed(() => textDetailHero.value ? getFieldPath(textDetailHero.value.id, textDetailField.value) : '')
const textDetailModalTitle = computed(() => {
  if (!textDetailHero.value || textDetailHeroIndex.value < 0) return textDetailTitle.value
  return `${CONTINENTS[textDetailHeroIndex.value].name} · ${textDetailHero.value.element}元素英雄 — ${textDetailTitle.value}`
})
const textDetailContent = computed(() => {
  if (!textDetailHero.value) return ''
  return textDetailField.value === 'visual' ? textDetailHero.value.visual : textDetailHero.value.personality
})
const textDetailBaseContent = computed(() =>
  textDetailFieldPath.value ? worldStore.getFieldMeta('heroSystem', textDetailFieldPath.value).baseContent || '' : ''
)
const textDetailLastEditBy = computed(() =>
  textDetailFieldPath.value ? worldStore.getFieldMeta('heroSystem', textDetailFieldPath.value).lastEditBy || '' : ''
)
const textDetailDisabled = computed(() =>
  textDetailHero.value ? isFinalized(textDetailHero.value.id, textDetailField.value) : true
)

function openTextDetail(index: number, field: 'visual' | 'personality') {
  textDetailHeroIndex.value = index
  textDetailField.value = field
  showTextDetailModal.value = true
}

function closeTextDetail() {
  showTextDetailModal.value = false
  textDetailHeroIndex.value = -1
}

function handleTextDetailShowUpdate(show: boolean) {
  if (show) {
    showTextDetailModal.value = true
  } else {
    closeTextDetail()
  }
}

function updateTextDetailContent(value: string) {
  const hero = textDetailHero.value
  if (!hero) return
  hero[textDetailField.value] = value
  onFieldInput(hero.id, textDetailField.value)
}

// 背景故事弹窗状态
const showBackstoryModal = ref(false)
const currentBackstoryIndex = ref(-1)
const backstoryEditMode = ref(false)

// 直接引用 store 中的响应式英雄对象（而非副本），确保编辑写回 store 触发自动保存
const currentHero = computed(() =>
  currentBackstoryIndex.value >= 0 ? heroes[currentBackstoryIndex.value] : null
)
const currentContinent = computed(() =>
  currentBackstoryIndex.value >= 0 ? CONTINENTS[currentBackstoryIndex.value] : null
)

function openBackstory(index: number) {
  if (!isMvpHero(index)) return
  currentBackstoryIndex.value = index
  backstoryEditMode.value = false
  showBackstoryModal.value = true
}

function closeBackstory() {
  showBackstoryModal.value = false
  currentBackstoryIndex.value = -1
  backstoryEditMode.value = false
}

/** 立即保存当前背景故事到服务器 */
function saveBackstoryNow() {
  if (currentHero.value) {
    worldStore.updateFieldEditMeta('heroSystem', getFieldPath(currentHero.value.id, 'backstory'), 'user')
  }
  worldStore.saveNow()
}

// 元素名到英雄数组索引的映射
const elementToIndex: Record<string, number> = {
  '金': 0, '森': 1, '木': 1, '冰': 2, '火': 3, '土': 4, '风': 5, '雷': 6, '光': 7, '暗': 8
}

// 英雄字段标签，用于解析 AI 输出中的 key-value 行
const heroFieldLabels: Record<string, string[]> = {
  name: ['名字', '名称', '英雄名'],
  visual: ['视觉描述', '视觉', '外观', '视觉风格'],
  personality: ['性格特征', '性格', '核心性格'],
  backstory: ['背景故事', '背景', '简要背景'],
  role: ['角色设定', '故事角色', '角色定位', '角色', '在故事中的角色'],
  joinCondition: ['加入条件', '加入'],
  joinStage: ['加入时机', '加入阶段'],
  storyRole: ['故事角色定位', '角色定位', '故事定位']
}

const heroFieldKeys = ['name', 'visual', 'personality', 'backstory', 'role', 'joinCondition', 'joinStage', 'storyRole']

function getFieldPath(heroId: string, field: string): string {
  return `${heroId}.${field}`
}

function isFinalized(heroId: string, field: string): boolean {
  return worldStore.isFieldFinalized('heroSystem', getFieldPath(heroId, field))
}

function toggleFinalize(heroId: string, field: string) {
  const fp = getFieldPath(heroId, field)
  if (worldStore.isFieldFinalized('heroSystem', fp)) {
    worldStore.unfinalizeField('heroSystem', fp)
  } else {
    worldStore.finalizeField('heroSystem', fp)
  }
}

function finalizeAll() {
  const paths = heroes.flatMap(h => heroFieldKeys.map(k => getFieldPath(h.id, k)))
  worldStore.finalizeModule('heroSystem', paths)
}

function unfinalizeAll() {
  for (const h of heroes) {
    for (const k of heroFieldKeys) {
      worldStore.unfinalizeField('heroSystem', getFieldPath(h.id, k))
    }
  }
}

function onFieldInput(heroId: string, field: string) {
  worldStore.updateFieldEditMeta('heroSystem', getFieldPath(heroId, field), 'user')
}

function checkFieldConflicts(): ConflictField[] {
  const conflicts: ConflictField[] = []
  for (const h of heroes) {
    for (const k of heroFieldKeys) {
      const fp = getFieldPath(h.id, k)
      const meta = worldStore.getFieldMeta('heroSystem', fp)
      if (meta.status === 'finalized' || meta.lastEditSource === 'user') {
        conflicts.push({ fieldPath: fp, label: `${h.continent} - ${k}`, meta })
      }
    }
  }
  return conflicts
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 格式化背景故事文本为HTML（保留段落结构）
function formatBackstory(text: string): string {
  return text
    .split(/\n\n+/)
    .map(para => {
      const trimmed = para.trim()
      if (!trimmed) return ''
      // 检测标题行（如【第一幕：xxx】）
      if (/^【.*】$/.test(trimmed)) {
        return `<h3 class="backstory-chapter">${escapeHtml(trimmed)}</h3>`
      }
      return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`
    })
    .filter(Boolean)
    .join('')
}

function handleAIAccept(content: string, skippedFields?: string[]) {
  const sections = parseSections(content)
  const skip = new Set(skippedFields || [])

  if (Object.keys(sections).length === 0) return

  for (const [sectionKey, sectionContent] of Object.entries(sections)) {
    // 从 section key 中提取元素名（如 "金元素英雄" → "金"）
    let heroIndex = -1
    for (const [element, idx] of Object.entries(elementToIndex)) {
      if (sectionKey.includes(element)) {
        heroIndex = idx
        break
      }
    }

    if (heroIndex < 0 || heroIndex >= heroes.length) continue

    const parsed = parseKeyValueBlock(sectionContent, heroFieldLabels)
    const hero = heroes[heroIndex]

    if (parsed.name && !skip.has(getFieldPath(hero.id, 'name'))) { hero.name = parsed.name; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'name'), 'ai') }
    if (parsed.visual && !skip.has(getFieldPath(hero.id, 'visual'))) { hero.visual = parsed.visual; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'visual'), 'ai') }
    if (parsed.personality && !skip.has(getFieldPath(hero.id, 'personality'))) { hero.personality = parsed.personality; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'personality'), 'ai') }
    if (parsed.backstory && !skip.has(getFieldPath(hero.id, 'backstory'))) { hero.backstory = parsed.backstory; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'backstory'), 'ai') }
    if (parsed.role && !skip.has(getFieldPath(hero.id, 'role'))) { hero.role = parsed.role; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'role'), 'ai') }
    if (parsed.joinCondition && !skip.has(getFieldPath(hero.id, 'joinCondition'))) { hero.joinCondition = parsed.joinCondition; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'joinCondition'), 'ai') }
    if (parsed.joinStage && !skip.has(getFieldPath(hero.id, 'joinStage'))) { hero.joinStage = parsed.joinStage; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'joinStage'), 'ai') }
    if (parsed.storyRole && !skip.has(getFieldPath(hero.id, 'storyRole'))) { hero.storyRole = parsed.storyRole; worldStore.updateFieldEditMeta('heroSystem', getFieldPath(hero.id, 'storyRole'), 'ai') }
  }
}

// ===== 背景故事独立生成区域 =====
const backstoryHeroKey = ref<'jin' | 'bing' | 'huo'>('jin')

const backstoryHeroIndexMap: Record<string, number> = { jin: 0, bing: 2, huo: 3 }

const backstoryModuleId = computed(() => `hero-backstory-${backstoryHeroKey.value}`)

const currentBackstoryHeroForGen = computed(() => {
  const idx = backstoryHeroIndexMap[backstoryHeroKey.value]
  return worldStore.state.heroSystem[idx]
})

const backstoryOpinions = ref<Record<string, string>>({
  jin: '',
  bing: '',
  huo: ''
})

onMounted(() => {
  const saved = localStorage.getItem('hero-backstory-opinions')
  if (saved) {
    try { backstoryOpinions.value = JSON.parse(saved) } catch {}
  }
})

watch(backstoryOpinions, (val) => {
  localStorage.setItem('hero-backstory-opinions', JSON.stringify(val))
}, { deep: true })

const backstoryExtraContext = computed(() => {
  const hero = currentBackstoryHeroForGen.value
  const ctx: Record<string, string> = {}

  if (hero) {
    const info = [
      `英雄名称：${hero.name || '未设定'}`,
      `元素属性：${hero.element || '未设定'}`,
      `所属大陆：${hero.continent || '未设定'}`,
      `性格特征：${hero.personality || '未设定'}`,
      `角色定位：${hero.role || '未设定'}`,
      `角色设定：${hero.storyRole || '未设定'}`
    ].join('\n')
    ctx['HERO_CURRENT_DATA'] = info
  }

  const opinions = backstoryOpinions.value[backstoryHeroKey.value]
  if (opinions && opinions.trim()) {
    ctx['CLIENT_OPINIONS'] = opinions.trim()
  }

  return ctx
})

function handleBackstoryAccept(content: string) {
  const hero = currentBackstoryHeroForGen.value
  if (!hero) return
  hero.backstory = content
  worldStore.updateFieldEditMeta('heroSystem', `${hero.id}.backstory`, 'ai')
}

function buildHeroSystemReference(): string {
  return heroes
    .filter(hero => [hero.name, hero.visual, hero.personality, hero.backstory, hero.role, hero.joinStage, hero.joinCondition, hero.storyRole].some(v => v?.trim()))
    .map(hero => [
      `【${hero.element || '未定'}元素英雄】`,
      `名字：${hero.name || '（未填写）'}`,
      `大陆：${hero.continent || '（未填写）'}`,
      `视觉描述：${hero.visual || '（未填写）'}`,
      `性格特征：${hero.personality || '（未填写）'}`,
      `背景故事：${hero.backstory || '（未填写）'}`,
      `角色定位：${hero.role || '（未填写）'}`,
      `加入阶段：${hero.joinStage || '（未填写）'}`,
      `加入条件：${hero.joinCondition || '（未填写）'}`,
      `故事角色：${hero.storyRole || '（未填写）'}`
    ].join('\n'))
    .join('\n\n')
}

async function syncHeroSystem() {
  const content = buildHeroSystemReference().trim()
  if (!content) {
    message.warning('当前模块内容为空，无法同步')
    return
  }
  syncingModule.value = true
  try {
    await syncModuleReferenceBatch('heroSystem', { content })
    message.success('英雄系统已同步到提示词参考文件')
  } catch (e: any) {
    message.error(e?.message || '同步失败')
  } finally {
    syncingModule.value = false
  }
}
</script>

<template>
  <div class="content-section hero-system-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <h2>英雄系统定位</h2>
      <NSpace :size="6">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton size="tiny" quaternary :loading="syncingModule" @click="syncHeroSystem">⬆同步</NButton>
          </template>
          同步到提示词文件 (hero-system-refs.ts)
        </NTooltip>
        <NButton size="tiny" quaternary @click="finalizeAll">全部定稿</NButton>
        <NButton size="tiny" quaternary @click="unfinalizeAll">全部解锁</NButton>
      </NSpace>
    </div>
    <p class="section-desc">九大陆九位英雄，每位英雄对应一个元素大陆。MVP版本优先设计前三位（金、冰、火）。</p>

    <div class="hero-grid">
      <div v-for="(hero, index) in heroes" :key="hero.id" class="hero-card" :class="{ 'hero-card--locked': !isMvpHero(index) }">
        <div class="hero-header" :style="{ borderLeftColor: CONTINENTS[index].color }">
          <span class="hero-icon">{{ CONTINENTS[index].icon }}</span>
          <span class="hero-title">{{ CONTINENTS[index].name }} · {{ hero.element }}元素英雄</span>
          <span v-if="isMvpHero(index)" class="mvp-badge">MVP</span>
          <span v-else class="locked-badge">🔒</span>
        </div>

        <!-- MVP 英雄：完整编辑界面 -->
        <div v-if="isMvpHero(index)" class="hero-body">
          <div class="field-group">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="flex:1;">英雄名称</label>
              <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized(hero.id, 'name') ? 'warning' : 'default'" quaternary @click="toggleFinalize(hero.id, 'name')">{{ isFinalized(hero.id, 'name') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized(hero.id, 'name') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
              <span
                v-if="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'name')).finalizedBy"
                class="finalized-tag"
                :class="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'name')).finalizedBy === 'yongge' ? 'client' : 'admin'"
              >
                {{ worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'name')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
              </span>
            </div>
            <NInput v-model:value="hero.name" placeholder="西幻风格名字" size="small" :maxlength="500" :disabled="isFinalized(hero.id, 'name')" :style="isFinalized(hero.id, 'name') ? 'opacity: 0.7;' : ''" :class="{ 'edited-by-client': worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'name')).lastEditBy === 'yongge' }" @input="onFieldInput(hero.id, 'name')" />
          </div>
          <div class="field-group">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="flex:1;">视觉描述</label>
              <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized(hero.id, 'visual') ? 'warning' : 'default'" quaternary @click="toggleFinalize(hero.id, 'visual')">{{ isFinalized(hero.id, 'visual') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized(hero.id, 'visual') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
              <span
                v-if="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'visual')).finalizedBy"
                class="finalized-tag"
                :class="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'visual')).finalizedBy === 'yongge' ? 'client' : 'admin'"
              >
                {{ worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'visual')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
              </span>
            </div>
            <div class="text-preview-box" :class="{ 'edited-by-client': worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'visual')).lastEditBy === 'yongge' }" :style="isFinalized(hero.id, 'visual') ? 'opacity: 0.7;' : ''" @click="openTextDetail(index, 'visual')">
              <span v-if="hero.visual" class="text-preview-content">{{ hero.visual }}</span>
              <span v-else class="text-preview-placeholder">一句话描述外观</span>
              <span class="text-preview-expand-hint">点击查看完整内容</span>
            </div>
          </div>
          <div class="field-group">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="flex:1;">性格特征</label>
              <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized(hero.id, 'personality') ? 'warning' : 'default'" quaternary @click="toggleFinalize(hero.id, 'personality')">{{ isFinalized(hero.id, 'personality') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized(hero.id, 'personality') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
              <span
                v-if="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'personality')).finalizedBy"
                class="finalized-tag"
                :class="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'personality')).finalizedBy === 'yongge' ? 'client' : 'admin'"
              >
                {{ worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'personality')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
              </span>
            </div>
            <div class="text-preview-box" :class="{ 'edited-by-client': worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'personality')).lastEditBy === 'yongge' }" :style="isFinalized(hero.id, 'personality') ? 'opacity: 0.7;' : ''" @click="openTextDetail(index, 'personality')">
              <span v-if="hero.personality" class="text-preview-content">{{ hero.personality }}</span>
              <span v-else class="text-preview-placeholder">核心性格</span>
              <span class="text-preview-expand-hint">点击查看完整内容</span>
            </div>
          </div>

          <!-- 背景故事：独立按钮触发弹窗 -->
          <div class="field-group backstory-trigger">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="flex:1;">背景故事</label>
              <NButton size="tiny" type="primary" ghost @click="openBackstory(index)">
                {{ hero.backstory ? '📖 查看背景故事' : '📖 暂无故事' }}
              </NButton>
            </div>
            <div v-if="hero.backstory" class="backstory-preview">{{ hero.backstory.slice(0, 80) }}...</div>
            <div v-else class="backstory-preview backstory-empty">尚未编写背景故事</div>
          </div>

          <NCollapse>
            <NCollapseItem title="更多设定" name="more">
              <div class="field-group">
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="flex:1;">角色设定</label>
                  <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized(hero.id, 'role') ? 'warning' : 'default'" quaternary @click="toggleFinalize(hero.id, 'role')">{{ isFinalized(hero.id, 'role') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized(hero.id, 'role') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
                  <span
                    v-if="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'role')).finalizedBy"
                    class="finalized-tag"
                    :class="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'role')).finalizedBy === 'yongge' ? 'client' : 'admin'"
                  >
                    {{ worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'role')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
                  </span>
                </div>
                <CollabTextField v-model="hero.role" :base-content="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'role')).baseContent || ''" :last-edit-by="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'role')).lastEditBy || ''" placeholder="在故事中的角色定位" :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="20000" show-count :disabled="isFinalized(hero.id, 'role')" show-expand-button field-label="角色设定" @input="onFieldInput(hero.id, 'role')" />
              </div>
              <div class="field-group">
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="flex:1;">加入时机</label>
                  <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized(hero.id, 'joinStage') ? 'warning' : 'default'" quaternary @click="toggleFinalize(hero.id, 'joinStage')">{{ isFinalized(hero.id, 'joinStage') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized(hero.id, 'joinStage') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
                  <span
                    v-if="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'joinStage')).finalizedBy"
                    class="finalized-tag"
                    :class="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'joinStage')).finalizedBy === 'yongge' ? 'client' : 'admin'"
                  >
                    {{ worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'joinStage')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
                  </span>
                </div>
                <CollabTextField v-model="hero.joinStage" :base-content="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'joinStage')).baseContent || ''" :last-edit-by="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'joinStage')).lastEditBy || ''" placeholder="描述该英雄在哪个阶段/区域加入玩家阵营..." :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="20000" show-count :disabled="isFinalized(hero.id, 'joinStage')" show-expand-button field-label="加入时机" @input="onFieldInput(hero.id, 'joinStage')" />
              </div>
              <div class="field-group">
                <div style="display:flex;align-items:center;gap:6px;">
                  <label style="flex:1;">故事角色定位</label>
                  <NTooltip trigger="hover"><template #trigger><NButton size="tiny" :type="isFinalized(hero.id, 'storyRole') ? 'warning' : 'default'" quaternary @click="toggleFinalize(hero.id, 'storyRole')">{{ isFinalized(hero.id, 'storyRole') ? '🔒' : '📝' }}</NButton></template>{{ isFinalized(hero.id, 'storyRole') ? '点击解除定稿' : '点击定稿' }}</NTooltip>
                  <span
                    v-if="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'storyRole')).finalizedBy"
                    class="finalized-tag"
                    :class="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'storyRole')).finalizedBy === 'yongge' ? 'client' : 'admin'"
                  >
                    {{ worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'storyRole')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
                  </span>
                </div>
                <CollabTextField v-model="hero.storyRole" :base-content="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'storyRole')).baseContent || ''" :last-edit-by="worldStore.getFieldMeta('heroSystem', getFieldPath(hero.id, 'storyRole')).lastEditBy || ''" placeholder="描述该英雄在整体故事中扮演的角色..." :autosize="{ minRows: 2, maxRows: 15 }" :maxlength="20000" show-count :disabled="isFinalized(hero.id, 'storyRole')" show-expand-button field-label="故事角色定位" @input="onFieldInput(hero.id, 'storyRole')" />
              </div>
            </NCollapseItem>
          </NCollapse>
        </div>

        <!-- 非MVP英雄：待探索占位 -->
        <div v-else class="hero-body hero-body--locked">
          <div class="locked-placeholder">
            <span class="locked-icon">🔮</span>
            <p class="locked-text">待探索</p>
            <p class="locked-hint">该英雄将在后续版本中解锁</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 视觉描述/性格特征 文本详情弹窗 -->
    <FullTextEditModal
      :show="showTextDetailModal"
      :title="textDetailModalTitle"
      :model-value="textDetailContent"
      :disabled="textDetailDisabled"
      :base-content="textDetailBaseContent"
      :last-edit-by="textDetailLastEditBy"
      @update:show="handleTextDetailShowUpdate"
      @update:model-value="updateTextDetailContent"
    />

    <!-- 背景故事弹窗（可编辑，直接绑定 store，修改自动触发持久化保存） -->
    <NModal
      v-model:show="showBackstoryModal"
      preset="card"
      :title="currentHero ? `${currentContinent?.name} · ${currentHero.element}元素英雄 — ${currentHero.name}` : '背景故事'"
      style="width: 720px; max-width: 90vw;"
      :mask-closable="true"
      @after-leave="closeBackstory"
    >
      <template #header-extra>
        <NSpace :size="6">
          <NButton size="small" :type="backstoryEditMode ? 'primary' : 'default'" ghost @click="backstoryEditMode = !backstoryEditMode">
            {{ backstoryEditMode ? '📖 预览' : '✏️ 编辑' }}
          </NButton>
          <NButton size="small" type="primary" @click="saveBackstoryNow">💾 立即保存</NButton>
        </NSpace>
      </template>
      <NScrollbar style="max-height: 70vh;">
        <div v-if="currentHero" class="backstory-modal-content">
          <!-- 编辑模式：直接绑定 store 响应式数据，输入即触发自动保存 -->
          <template v-if="backstoryEditMode">
            <CollabTextField
              v-model="currentHero.backstory"
              :base-content="currentHero ? worldStore.getFieldMeta('heroSystem', getFieldPath(currentHero.id, 'backstory')).baseContent || '' : ''"
              :last-edit-by="currentHero ? worldStore.getFieldMeta('heroSystem', getFieldPath(currentHero.id, 'backstory')).lastEditBy || '' : ''"
              placeholder="在此编写英雄背景故事，支持【第X幕：标题】格式划分章节..."
              :autosize="{ minRows: 15, maxRows: 40 }"
              :maxlength="20000"
              show-count
              @input="onFieldInput(currentHero.id, 'backstory')"
            />
            <div v-if="currentHero && worldStore.getFieldMeta('heroSystem', getFieldPath(currentHero.id, 'backstory')).finalizedBy" style="margin-top: 8px;">
              <span
                class="finalized-tag"
                :class="worldStore.getFieldMeta('heroSystem', getFieldPath(currentHero.id, 'backstory')).finalizedBy === 'yongge' ? 'client' : 'admin'"
              >
                {{ worldStore.getFieldMeta('heroSystem', getFieldPath(currentHero.id, 'backstory')).finalizedBy === 'yongge' ? '甲方定稿' : '开发者定稿' }}
              </span>
            </div>
          </template>
          <!-- 预览模式：格式化展示 -->
          <template v-else>
            <div v-if="currentHero.backstory" class="backstory-text" v-html="formatBackstory(currentHero.backstory)"></div>
            <div v-else class="backstory-empty-modal">
              <p>该英雄的背景故事尚未编写。</p>
              <NButton size="small" @click="backstoryEditMode = true">✏️ 开始编写</NButton>
            </div>
          </template>
        </div>
      </NScrollbar>
    </NModal>

   <AIPanel
      module-id="hero-system"
      :context-labels="['三界结构', '玩家身份']"
      :check-field-conflicts="checkFieldConflicts"
      @accept="(c: string) => handleAIAccept(c)"
      @accept-partial="(c: string, skipped: string[]) => handleAIAccept(c, skipped)"
    />

    <!-- 背景故事独立生成区域 -->
    <div class="backstory-generation-section">
      <h3 class="section-title">英雄背景故事生成</h3>
      <p class="section-desc">为每位MVP英雄独立生成"遇见主角前"的详细背景故事，基于主线剧情和世界观设定。</p>

      <!-- 英雄选择器 -->
      <div class="backstory-hero-selector">
        <span class="selector-label">选择英雄：</span>
        <button
          v-for="item in [
            { key: 'jin', label: '金·' + (worldStore.state.heroSystem[0]?.name || '金元素英雄') },
            { key: 'bing', label: '冰·' + (worldStore.state.heroSystem[2]?.name || '冰元素英雄') },
            { key: 'huo', label: '火·' + (worldStore.state.heroSystem[3]?.name || '火元素英雄') }
          ]"
          :key="item.key"
          :class="['hero-select-btn', { active: backstoryHeroKey === item.key }]"
          @click="backstoryHeroKey = item.key as 'jin' | 'bing' | 'huo'"
        >
          {{ item.label }}
        </button>
      </div>

      <!-- 甲方意见输入 -->
      <div class="backstory-opinions">
        <label class="opinions-label">甲方要求/意见（可选）：</label>
        <textarea
          v-model="backstoryOpinions[backstoryHeroKey]"
          class="opinions-textarea"
          placeholder="输入针对该英雄背景故事的特殊要求或甲方意见，将注入AI生成的prompt中..."
          rows="3"
        />
      </div>

      <!-- AI面板 -->
      <AIPanel
        :module-id="backstoryModuleId"
        :context-labels="['三界概述', '凡界设定', '主线剧情', '英雄系统']"
        :extra-context="backstoryExtraContext"
        @accept="handleBackstoryAccept"
      />
    </div>
  </div>
</template>

<style scoped>
/* 覆盖父级 max-width 限制，充分利用可用宽度 */
.hero-system-section {
  max-width: 100%;
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  width: 100%;
}

.hero-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-card);
  min-width: 0; /* 防止内容撑开导致溢出 */
}

.hero-header {
  padding: 10px 14px;
  background: var(--color-bg-secondary);
  border-left: 3px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.hero-icon {
  font-size: 16px;
}

.hero-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mvp-badge {
  font-size: 13px;
  padding: 1px 6px;
  background: var(--color-primary);
  color: var(--color-bg-primary);
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
}

.locked-badge {
  font-size: 13px;
  padding: 1px 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text-tertiary);
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
}

.hero-card--locked {
  opacity: 0.65;
}

.hero-card--locked .hero-header {
  filter: grayscale(0.4);
}

.hero-body {
  padding: 12px 14px;
}

.hero-body .field-group {
  margin-bottom: 10px;
}

.hero-body .field-group label {
  font-size: 13px;
  margin-bottom: 4px;
}

/* 待探索占位 */
.hero-body--locked {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
}

.locked-placeholder {
  text-align: center;
  color: var(--color-text-tertiary);
}

.locked-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.locked-text {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--color-text-secondary);
}

.locked-hint {
  font-size: 12px;
  margin: 0;
  color: var(--color-text-tertiary);
}

/* 背景故事预览 */
.backstory-trigger {
  border-top: 1px dashed var(--color-border);
  padding-top: 8px;
  margin-top: 4px;
}

.backstory-preview {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backstory-empty {
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* 文本预览框（视觉描述/性格特征） */
.text-preview-box {
  position: relative;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  background: rgba(15, 15, 30, 0.6);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 42px;
}

.text-preview-box:hover {
  border-color: rgba(212, 175, 55, 0.6);
  box-shadow: 0 0 6px rgba(212, 175, 55, 0.15);
}

.text-preview-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-primary, #e0e0e0);
  word-break: break-all;
}

.text-preview-placeholder {
  font-size: 13px;
  color: var(--color-text-tertiary, #666);
}

.text-preview-expand-hint {
  display: none;
  position: absolute;
  right: 6px;
  bottom: 2px;
  font-size: 11px;
  color: rgba(212, 175, 55, 0.7);
  pointer-events: none;
}

.text-preview-box:hover .text-preview-expand-hint {
  display: inline;
}

/* 文本详情弹窗 */
.text-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.text-detail-modal {
  width: 560px;
  max-width: 90vw;
  max-height: 70vh;
  border-radius: 4px;
  border: 1px solid rgba(212, 168, 83, 0.4);
  background: linear-gradient(180deg, rgba(26, 20, 14, 0.98) 0%, rgba(18, 13, 9, 0.99) 100%);
  box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.text-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
}

.text-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: #d4af37;
  margin: 0;
}

.text-detail-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}

.text-detail-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.text-detail-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.text-detail-content {
  font-size: 14px;
  line-height: 1.8;
  color: #e0e0e0;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.text-detail-empty {
  font-size: 14px;
  color: #666;
  text-align: center;
  padding: 24px 0;
  margin: 0;
}

/* 背景故事弹窗内容 */
.backstory-modal-content {
  padding: 8px 16px;
  line-height: 1.8;
  font-size: 15px;
  color: var(--color-text-primary);
}

.backstory-modal-content :deep(.backstory-chapter) {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-primary);
  margin: 24px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.backstory-modal-content :deep(.backstory-chapter:first-child) {
  margin-top: 0;
}

.backstory-modal-content :deep(p) {
  margin: 0 0 12px;
  text-indent: 2em;
}

.backstory-empty-modal {
  text-align: center;
  padding: 40px 0;
  color: var(--color-text-tertiary);
  font-size: 14px;
}

/* 大屏幕优化：强制更多列 */
@media (min-width: 1600px) {
  .hero-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

/* 平板适配 */
@media (max-width: 768px) {
  .hero-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .hero-body {
    padding: 10px 12px;
  }
}

/* 小屏手机适配 */
@media (max-width: 480px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

/* 背景故事独立生成区域 */
.backstory-generation-section {
  margin-top: 32px;
  padding: 24px;
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 8px;
  background: rgba(26, 26, 46, 0.5);
}

.backstory-generation-section .section-title {
  font-size: 18px;
  color: #d4af37;
  margin-bottom: 8px;
}

.backstory-generation-section .section-desc {
  font-size: 13px;
  color: #8a8a9a;
  margin-bottom: 16px;
}

.backstory-hero-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.selector-label {
  font-size: 14px;
  color: #c0c0d0;
}

.hero-select-btn {
  padding: 6px 16px;
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 4px;
  background: transparent;
  color: #c0c0d0;
  cursor: pointer;
  transition: all 0.2s;
}

.hero-select-btn:hover {
  border-color: #d4af37;
  color: #d4af37;
}

.hero-select-btn.active {
  background: rgba(212, 175, 55, 0.2);
  border-color: #d4af37;
  color: #d4af37;
}

.backstory-opinions {
  margin-bottom: 16px;
}

.opinions-label {
  display: block;
  font-size: 13px;
  color: #c0c0d0;
  margin-bottom: 6px;
}

.opinions-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 4px;
  background: rgba(15, 15, 30, 0.6);
  color: #e0e0e0;
  font-size: 13px;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.opinions-textarea:focus {
  border-color: #d4af37;
}

.opinions-textarea::placeholder {
  color: #666;
}
</style>
