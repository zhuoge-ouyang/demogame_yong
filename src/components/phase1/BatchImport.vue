<script setup lang="ts">
import { ref, computed } from 'vue'
import { NInput, NButton, NAlert, NModal, NList, NListItem, NTag } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import { parseSections, HERO_FIELD_LABELS } from '@/services/ai-content-parser'

const worldStore = useWorldStore()
const inputText = ref('')
const parseResult = ref<{
  success: { module: string; fields: string[] }[]
  unrecognized: string[]
} | null>(null)

// 确认覆盖弹窗
const showConfirmModal = ref(false)
const existingFields = ref<{ module: string; field: string }[]>([])

// 元素到英雄索引的映射
const ELEMENT_TO_INDEX: Record<string, number> = {
  '金': 0, '金元素': 0,
  '森': 1, '森元素': 1, '木': 1, '木元素': 1,
  '冰': 2, '冰元素': 2,
  '火': 3, '火元素': 3,
  '土': 4, '土元素': 4,
  '风': 5, '风元素': 5,
  '雷': 6, '雷元素': 6,
  '光': 7, '光元素': 7,
  '暗': 8, '暗元素': 8
}

// 标记到字段的完整映射表
const REALM_MAPPING: Record<string, { path: string; field: string }> = {
  '三界概述': { path: 'realmStructure', field: 'summary' },
  '上界-过去': { path: 'realmStructure.upper', field: 'past' },
  '上界-现状': { path: 'realmStructure.upper', field: 'present' },
  '上界-未来': { path: 'realmStructure.upper', field: 'future' },
  '凡界-过去': { path: 'realmStructure.mortal', field: 'past' },
  '凡界-现状': { path: 'realmStructure.mortal', field: 'present' },
  '凡界-未来': { path: 'realmStructure.mortal', field: 'future' },
  '深渊-过去': { path: 'realmStructure.abyss', field: 'past' },
  '深渊-现状': { path: 'realmStructure.abyss', field: 'present' },
  '深渊-未来': { path: 'realmStructure.abyss', field: 'future' }
}

const STORYLINE_MAPPING: Record<string, { stage: number; field: string }> = {
  '整体概述': { stage: -1, field: 'overview' },
  '主线整体概述': { stage: -1, field: 'overview' },
  '第一章-名称': { stage: 0, field: 'name' },
  '第一章-目标': { stage: 0, field: 'goal' },
  '第一章-事件': { stage: 0, field: 'events' },
  '第一章-结局': { stage: 0, field: 'resolution' },
  '第二章-名称': { stage: 1, field: 'name' },
  '第二章-目标': { stage: 1, field: 'goal' },
  '第二章-事件': { stage: 1, field: 'events' },
  '第二章-结局': { stage: 1, field: 'resolution' },
  '第三章-名称': { stage: 2, field: 'name' },
  '第三章-目标': { stage: 2, field: 'goal' },
  '第三章-事件': { stage: 2, field: 'events' },
  '第三章-结局': { stage: 2, field: 'resolution' },
  '第一阶段-名称': { stage: 0, field: 'name' },
  '第一阶段-目标': { stage: 0, field: 'goal' },
  '第一阶段-事件': { stage: 0, field: 'events' },
  '第一阶段-结局': { stage: 0, field: 'resolution' },
  '第二阶段-名称': { stage: 1, field: 'name' },
  '第二阶段-目标': { stage: 1, field: 'goal' },
  '第二阶段-事件': { stage: 1, field: 'events' },
  '第二阶段-结局': { stage: 1, field: 'resolution' },
  '第三阶段-名称': { stage: 2, field: 'name' },
  '第三阶段-目标': { stage: 2, field: 'goal' },
  '第三阶段-事件': { stage: 2, field: 'events' },
  '第三阶段-结局': { stage: 2, field: 'resolution' }
}

const PLAYER_IDENTITY_MAPPING: Record<string, string> = {
  '起源概念': 'origin',
  '初始认知': 'initialPerception',
  '揭示弧线': 'revelationArc',
  '玩法整合': 'gameplayIntegration'
}

const CASTLE_MAPPING: Record<string, string> = {
  '城堡描述': 'description',
  '城堡意义': 'significance'
}

const GODDESS_MAPPING: Record<string, string> = {
  '女神名字': 'name',
  '女神外观': 'appearance',
  '女神性格': 'personality'
}

const WORLD_TREE_MAPPING: Record<string, string> = {
  '成长机制': 'growthMechanism',
  '资源贡献': 'resourceContribution',
  '解锁功能': 'unlockedFeatures',
  '第四势力': 'fourthForce',
  '符文关联': 'runeConnection'
}

// 检查字段是否已有内容
function checkExistingFields(sections: Record<string, string>): { module: string; field: string }[] {
  const existing: { module: string; field: string }[] = []
  const state = worldStore.state

  // 检查三界结构
  for (const [key, mapping] of Object.entries(REALM_MAPPING)) {
    if (sections[key]) {
      const parts = mapping.path.split('.')
      let target: any = state
      for (const part of parts) {
        target = target[part]
      }
      if (target[mapping.field]?.trim()) {
        existing.push({ module: '三界结构', field: key })
      }
    }
  }

  // 检查主线
  for (const [key, mapping] of Object.entries(STORYLINE_MAPPING)) {
    if (sections[key]) {
      if (mapping.stage === -1) {
        if (state.mainStoryline.overview?.trim()) {
          existing.push({ module: '主线三章节', field: key })
        }
      } else {
        const stage = state.mainStoryline.stages[mapping.stage]
        if (stage[mapping.field as keyof typeof stage]?.trim()) {
          existing.push({ module: '主线三章节', field: key })
        }
      }
    }
  }

  // 检查玩家身份
  for (const [key, field] of Object.entries(PLAYER_IDENTITY_MAPPING)) {
    if (sections[key] && state.playerIdentity[field as keyof typeof state.playerIdentity]?.trim()) {
      existing.push({ module: '玩家身份', field: key })
    }
  }

  // 检查城堡
  for (const [key, field] of Object.entries(CASTLE_MAPPING)) {
    if (sections[key] && state.castleGoddess.castle[field as keyof typeof state.castleGoddess.castle]?.trim()) {
      existing.push({ module: '城堡女神', field: key })
    }
  }

  // 检查女神
  for (const [key, field] of Object.entries(GODDESS_MAPPING)) {
    if (sections[key] && state.castleGoddess.goddess[field as keyof typeof state.castleGoddess.goddess]?.trim()) {
      existing.push({ module: '城堡女神', field: key })
    }
  }

  // 检查世界树
  for (const [key, field] of Object.entries(WORLD_TREE_MAPPING)) {
    if (sections[key] && state.worldTreeSystem[field as keyof typeof state.worldTreeSystem]?.trim()) {
      existing.push({ module: '世界树系统', field: key })
    }
  }

  return existing
}

// 解析英雄内容
function parseHeroContent(content: string): { element: string; data: Record<string, string> } | null {
  const lines = content.split('\n')
  const data: Record<string, string> = {}

  for (const line of lines) {
    const match = line.match(/^\s*(?:\*\*)?([^：:]+)(?:\*\*)?[：:]\s*(.+)$/)
    if (match) {
      const label = match[1].trim()
      const value = match[2].trim()

      // 查找对应的字段
      for (const [fieldKey, aliases] of Object.entries(HERO_FIELD_LABELS)) {
        if (aliases.some(alias => label.includes(alias))) {
          data[fieldKey] = value
          break
        }
      }
    }
  }

  // 确定元素类型
  for (const element of Object.keys(ELEMENT_TO_INDEX)) {
    if (content.includes(element)) {
      return { element, data }
    }
  }

  return null
}

// 执行解析和填充
function doParseAndFill() {
  const sections = parseSections(inputText.value)
  const success: { module: string; fields: string[] }[] = []
  const unrecognized: string[] = []
  const state = worldStore.state

  // 处理三界结构
  const realmFields: string[] = []
  for (const [key, mapping] of Object.entries(REALM_MAPPING)) {
    if (sections[key]) {
      const parts = mapping.path.split('.')
      let target: any = state
      for (const part of parts) {
        target = target[part]
      }
      target[mapping.field] = sections[key]
      realmFields.push(key)
      delete sections[key]
    }
  }
  if (realmFields.length > 0) {
    success.push({ module: '三界结构', fields: realmFields })
  }

  // 处理主线
  const storylineFields: string[] = []
  for (const [key, mapping] of Object.entries(STORYLINE_MAPPING)) {
    if (sections[key]) {
      if (mapping.stage === -1) {
        state.mainStoryline.overview = sections[key]
      } else {
        const stage = state.mainStoryline.stages[mapping.stage]
        stage[mapping.field as keyof typeof stage] = sections[key]
      }
      storylineFields.push(key)
      delete sections[key]
    }
  }
  if (storylineFields.length > 0) {
    success.push({ module: '主线三章节', fields: storylineFields })
  }

  // 处理玩家身份
  const playerFields: string[] = []
  for (const [key, field] of Object.entries(PLAYER_IDENTITY_MAPPING)) {
    if (sections[key]) {
      state.playerIdentity[field as keyof typeof state.playerIdentity] = sections[key]
      playerFields.push(key)
      delete sections[key]
    }
  }
  if (playerFields.length > 0) {
    success.push({ module: '玩家身份', fields: playerFields })
  }

  // 处理城堡
  const castleFields: string[] = []
  for (const [key, field] of Object.entries(CASTLE_MAPPING)) {
    if (sections[key]) {
      state.castleGoddess.castle[field as keyof typeof state.castleGoddess.castle] = sections[key]
      castleFields.push(key)
      delete sections[key]
    }
  }

  // 处理女神
  const goddessFields: string[] = []
  for (const [key, field] of Object.entries(GODDESS_MAPPING)) {
    if (sections[key]) {
      state.castleGoddess.goddess[field as keyof typeof state.castleGoddess.goddess] = sections[key]
      goddessFields.push(key)
      delete sections[key]
    }
  }
  if (castleFields.length > 0 || goddessFields.length > 0) {
    success.push({ module: '城堡女神', fields: [...castleFields, ...goddessFields] })
  }

  // 处理世界树
  const worldTreeFields: string[] = []
  for (const [key, field] of Object.entries(WORLD_TREE_MAPPING)) {
    if (sections[key]) {
      state.worldTreeSystem[field as keyof typeof state.worldTreeSystem] = sections[key]
      worldTreeFields.push(key)
      delete sections[key]
    }
  }
  if (worldTreeFields.length > 0) {
    success.push({ module: '世界树系统', fields: worldTreeFields })
  }

  // 处理英雄系统
  const heroElements: string[] = []
  const heroKeys = Object.keys(sections).filter(key => key.includes('元素英雄'))
  for (const key of heroKeys) {
    const heroData = parseHeroContent(sections[key])
    if (heroData) {
      const index = ELEMENT_TO_INDEX[heroData.element]
      if (index !== undefined) {
        const hero = state.heroSystem[index]
        for (const [fieldKey, value] of Object.entries(heroData.data)) {
          if (fieldKey in hero) {
            (hero as any)[fieldKey] = value
          }
        }
        heroElements.push(heroData.element)
        delete sections[key]
      }
    }
  }
  if (heroElements.length > 0) {
    success.push({ module: '英雄系统', fields: heroElements.map(e => `${e}元素英雄`) })
  }

  // 剩余未识别的标记
  for (const key of Object.keys(sections)) {
    unrecognized.push(`【${key}】`)
  }

  parseResult.value = { success, unrecognized }
  showConfirmModal.value = false
}

// 分析处理按钮点击
function handleAnalyze() {
  if (!inputText.value.trim()) {
    parseResult.value = {
      success: [],
      unrecognized: ['请先粘贴世界观文本内容']
    }
    return
  }

  const sections = parseSections(inputText.value)
  const existing = checkExistingFields(sections)

  if (existing.length > 0) {
    existingFields.value = existing
    showConfirmModal.value = true
  } else {
    doParseAndFill()
  }
}

// 确认覆盖
function confirmOverwrite() {
  doParseAndFill()
}

// 清空按钮
function handleClear() {
  inputText.value = ''
  parseResult.value = null
}

// 获取成功状态颜色
function getSuccessColor(count: number, total: number): string {
  if (count === total) return 'success'
  if (count > 0) return 'warning'
  return 'default'
}
</script>

<template>
  <div class="content-section">
    <h2>批量导入世界观内容</h2>
    <p class="section-desc">
      粘贴包含【标记】格式的世界观文本，系统将自动解析并填充到各模块对应字段。
    </p>

    <div class="field-group">
      <label>批量导入世界观内容</label>
      <NInput
        v-model:value="inputText"
        type="textarea"
        placeholder="请粘贴包含【标记】格式的世界观文本内容，例如：
【三界概述】
三界由上界、凡界、深渊构成...

【上界-过去】
在远古时代...

【金元素英雄】
名字：亚瑟
视觉描述：金色铠甲...
性格特征：勇敢正义..."
        :autosize="{ minRows: 15, maxRows: 30 }"
      />
    </div>

    <div class="button-group">
      <NButton type="primary" size="large" @click="handleAnalyze">
        分析处理
      </NButton>
      <NButton size="large" @click="handleClear">
        清空
      </NButton>
    </div>

    <!-- 解析结果展示 -->
    <div v-if="parseResult" class="parse-result">
      <!-- 成功区域 -->
      <div v-if="parseResult.success.length > 0" class="result-section">
        <h3>解析成功</h3>
        <NAlert type="success" :show-icon="true">
          <div class="success-list">
            <div v-for="item in parseResult.success" :key="item.module" class="success-item">
              <NTag type="success">✓ {{ item.module }}</NTag>
              <span class="field-count">已填充 {{ item.fields.length }} 个字段</span>
              <div class="field-names">{{ item.fields.join('、') }}</div>
            </div>
          </div>
        </NAlert>
      </div>

      <!-- 未识别区域 -->
      <div v-if="parseResult.unrecognized.length > 0" class="result-section">
        <h3>未识别内容</h3>
        <NAlert type="warning" :show-icon="true">
          <p>以下标记未能识别或格式不正确：</p>
          <div class="unrecognized-list">
            <NTag v-for="(tag, index) in parseResult.unrecognized" :key="index" type="warning">
              {{ tag }}
            </NTag>
          </div>
        </NAlert>
      </div>
    </div>

    <!-- 确认覆盖弹窗 -->
    <NModal
      v-model:show="showConfirmModal"
      title="确认覆盖"
      preset="dialog"
      positive-text="确认导入"
      negative-text="取消"
      @positive-click="confirmOverwrite"
      @negative-click="showConfirmModal = false"
    >
      <p>以下字段已有内容，导入将覆盖现有数据：</p>
      <NList>
        <NListItem v-for="(item, index) in existingFields" :key="index">
          <NTag type="warning">{{ item.module }}</NTag>
          <span class="field-name">{{ item.field }}</span>
        </NListItem>
      </NList>
    </NModal>
  </div>
</template>

<style scoped>
.content-section {
  padding: 24px;
  max-width: 900px;
}

h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: var(--text-primary);
}

h3 {
  margin: 16px 0 8px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.section-desc {
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.field-group {
  margin-bottom: 20px;
}

.field-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.button-group {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.parse-result {
  margin-top: 24px;
}

.result-section {
  margin-bottom: 16px;
}

.success-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.success-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.success-item:last-child {
  border-bottom: none;
}

.field-count {
  color: var(--text-secondary);
  font-size: 14px;
}

.field-names {
  width: 100%;
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 4px;
  padding-left: 8px;
}

.unrecognized-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.field-name {
  margin-left: 8px;
  color: var(--text-secondary);
}
</style>
