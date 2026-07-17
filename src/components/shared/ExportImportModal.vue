<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NCard, NButton, NSpace, NAlert, NSelect, NDivider, NPopconfirm, NTag, NCollapse, NCollapseItem } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { useHistoryStore } from '@/stores/history'
import { CONTINENTS, CONTINENT_MAP } from '@/constants/continents'
import type { LandingContinentId } from '@/types/landing'
import {
  validateImportData,
  generateChecksum,
  verifyChecksum,
  type ValidationResult,
  type ImportSummary
} from '@/services/import-validator'

const show = defineModel<boolean>('show', { required: true })
const props = defineProps<{ mode: 'export' | 'import' }>()

const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()
const historyStore = useHistoryStore()

const importError = ref('')
const importSuccess = ref(false)

// 导入方式切换：'file' | 'history' | 'multi'
const importMode = ref<'file' | 'history' | 'multi'>('file')
// 选中的历史记录 id
const selectedHistoryId = ref<string | null>(null)

// ── 导入预览状态 ─────────────────────────────────────────
const importPreview = ref(false)
const pendingImportData = ref<Record<string, any> | null>(null)
const validationResult = ref<ValidationResult | null>(null)
const checksumMismatch = ref(false)

// ── 多文件导入状态 ───────────────────────────────────────
const multiWorldData = ref<any>(null)
const multiContinentsData = ref<any>(null)
const multiLandingData = ref<any>(null)
const multiWorldFileName = ref('')
const multiContinentsFileName = ref('')
const multiLandingFileName = ref('')

const historyOptions = computed(() =>
  historyStore.records.map(r => ({
    label: r.title,
    value: r.id
  }))
)

const selectedRecord = computed(() =>
  historyStore.records.find(r => r.id === selectedHistoryId.value) ?? null
)

// ── 导出后校验警告 ───────────────────────────────────────
const exportVerifyWarning = ref('')

// ── TXT 导出（原逻辑不变） ──────────────────────────────

function buildTxtContent(): string {
  const world = worldStore.getExportData()
  const continents = continentsStore.getExportData()
  const landing = landingStore.getExportData()
  const now = new Date().toLocaleString('zh-CN')

  const SEP  = '═'.repeat(60)
  const DASH = '─'.repeat(60)
  const lines: string[] = []

  const add = (s = '') => lines.push(s)
  const addField = (label: string, value: string, indent = '') => {
    if (!value?.trim()) return
    add(`${indent}【${label}】`)
    value.split('\n').forEach(row => add(`${indent}${row}`))
    add()
  }

  add(SEP)
  add('          西幻世界观 · 世界观完整文档')
  add(`          导出时间：${now}`)
  add(SEP)
  add()

  add('▓▓ 第一阶段：世界框架与核心叙事')
  add(SEP)
  add()

  add('一、三界结构')
  add(DASH)
  addField('整体概述', world.realmStructure.summary)
  const realmMap = [
    { key: 'upper' as const, name: '上界/神殿' },
    { key: 'mortal' as const, name: '凡界' },
    { key: 'abyss' as const, name: '深渊' }
  ]
  for (const r of realmMap) {
    const realm = world.realmStructure[r.key]
    if (!realm.past && !realm.present && !realm.future) continue
    add(`■ ${r.name}`)
    addField('过去', realm.past, '  ')
    addField('现状', realm.present, '  ')
    addField('未来', realm.future, '  ')
  }
  add()

  add('二、主线三章节目标')
  add(DASH)
  addField('整体概述', world.mainStoryline.overview)
  for (const s of world.mainStoryline.stages) {
    if (!s.goal && !s.events && !s.resolution) continue
    add(`■ ${s.name || '（未命名章节）'}`)
    addField('核心目标', s.goal, '  ')
    addField('关键事件', s.events, '  ')
    addField('章节结局', s.resolution, '  ')
  }
  add()

  add('三、玩家身份定义')
  add(DASH)
  addField('起源概念', world.playerIdentity.origin)
  addField('初始认知', world.playerIdentity.initialPerception)
  addField('揭示弧线', world.playerIdentity.revelationArc)
  addField('玩法整合', world.playerIdentity.gameplayIntegration)

  add('四、英雄系统')
  add(DASH)
  for (const h of world.heroSystem) {
    if (!h.name && !h.visual && !h.backstory && !h.personality) continue
    add(`■ ${h.element}元素英雄（${h.continent}）：${h.name || '（未命名）'}`)
    if (h.visual) add(`  视觉描述：${h.visual}`)
    if (h.personality) add(`  性格特征：${h.personality}`)
    addField('背景故事', h.backstory, '  ')
    addField('角色设定', h.role, '  ')
    addField('加入条件', h.joinCondition, '  ')
    addField('加入时机', h.joinStage, '  ')
    addField('故事角色定位', h.storyRole, '  ')
  }

  add('五、城堡与女神设定')
  add(DASH)
  add('◆ 城堡设计')
  addField('城堡描述', world.castleGoddess.castle.description, '  ')
  addField('叙事意义', world.castleGoddess.castle.significance, '  ')
  add('◆ 女神设计')
  if (world.castleGoddess.goddess.name) add(`  名字：${world.castleGoddess.goddess.name}`)
  addField('外观描述', world.castleGoddess.goddess.appearance, '  ')
  addField('性格设定', world.castleGoddess.goddess.personality, '  ')

  add('六、世界树系统')
  add(DASH)
  addField('成长阶段与机制', world.worldTreeSystem.growthMechanism)
  addField('资源贡献方式', world.worldTreeSystem.resourceContribution)
  addField('成长解锁功能', world.worldTreeSystem.unlockedFeatures)
  addField('第四势力形成', world.worldTreeSystem.fourthForce)
  addField('符文关联', world.worldTreeSystem.runeConnection)

  add(SEP)
  add('▓▓ 第二阶段：九大陆叙事设计')
  add(SEP)
  add()
  for (const c of CONTINENTS) {
    const data = continents[c.id]
    if (!data) continue
    const hasContent = Object.values(data.aspects).some(v => (v as string).trim())
    if (!hasContent) continue
    add(`${c.icon} ${c.name} · ${c.element}元素大陆`)
    add(DASH)
    addField('主线剧情', data.aspects.mainPlot)
    addField('核心冲突', data.aspects.coreConflict)
    addField('玩家目标', data.aspects.playerGoal)
    addField('体验定位', data.aspects.experiencePositioning)
    addField('游戏内表达方式', data.aspects.inGameExpression)
    addField('主题表达', data.aspects.themeExpression)
    addField('玩家推进变化', data.aspects.playerProgressionChanges)
    add()
  }

  add(SEP)
  add('▓▓ 第三阶段：前三大陆落地文案')
  add(SEP)
  add()
  const landingIds: LandingContinentId[] = ['jin', 'bing', 'huo']
  for (const id of landingIds) {
    const d = landing[id]
    const meta = CONTINENT_MAP[id]
    add(`${meta.icon} ${meta.name} · 落地文案`)
    add(DASH)
    add('◆ 少量系统对白')
    addField('开场', d.systemDialogue.opening, '  ')
    d.systemDialogue.actNodes.forEach((dialogue, index) => {
      addField(`第${index + 1}幕节点`, dialogue, '  ')
    })
    const hasBoss = d.bosses.some(b => b.name || b.identity)
    if (hasBoss) {
      add('◆ Boss设计')
      d.bosses.forEach((boss, i) => {
        if (!boss.name && !boss.identity) return
        add(`  ■ Boss #${i + 1}（第${boss.areaIndex}区域）：${boss.name || '（未命名）'}`)
        addField('身份', boss.identity, '    ')
        addField('动机', boss.motivation, '    ')
        if (boss.signatureLine) add(`    一句话台词：「${boss.signatureLine}」`)
      })
      add()
    }
    const hasLevels = d.levelNodes.some(n => n.storyPurpose || n.entryPrompt || n.completionFeedback || n.narrativeReward)
    if (hasLevels) {
      add('◆ 区域文案（3幕9区域）')
      d.levelNodes.forEach((node, i) => {
        if (!node.storyPurpose && !node.entryPrompt && !node.completionFeedback && !node.narrativeReward) return
        add(`  ■ 第${node.act}幕 · ${i + 1}. ${node.name || `区域${i + 1}`}`)
        addField('叙事任务', node.storyPurpose, '    ')
        addField('进入前提示', node.entryPrompt, '    ')
        addField('结束后反馈', node.completionFeedback, '    ')
        addField('叙事线索', node.narrativeReward, '    ')
      })
      add()
    }
    add()
  }

  add(SEP)
  add('（文档结束）')
  return lines.join('\n')
}

function handleExportTxt() {
  const content = buildTxtContent()
  const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `世界观文档_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ── 导出（带 checksum + 后校验） ────────────────────────

function buildExportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    world: worldStore.getExportData(),
    continents: continentsStore.getExportData(),
    landing: landingStore.getExportData()
  }
  const checksum = generateChecksum(payload)
  return { ...payload, checksum }
}

function handleExport() {
  exportVerifyWarning.value = ''
  const data = buildExportData()

  // 导出后校验
  try {
    const exportedJson = JSON.stringify(data, null, 2)
    const reparsed = JSON.parse(exportedJson)
    const validation = validateImportData(reparsed)
    if (!validation.valid) {
      exportVerifyWarning.value = `导出数据校验发现 ${validation.errors.length} 个异常，但文件仍已生成`
    }
  } catch { /* ignore */ }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `世界观数据_${dateSuffix()}.json`)
}

// ── 大文件拆分导出 ───────────────────────────────────────

function handleExportSplit() {
  exportVerifyWarning.value = ''
  const now = new Date().toISOString()
  const ds = dateSuffix()

  const worldPayload = { version: 1, exportedAt: now, phase: 'world', world: worldStore.getExportData() }
  const continentsPayload = { version: 1, exportedAt: now, phase: 'continents', continents: continentsStore.getExportData() }
  const landingPayload = { version: 1, exportedAt: now, phase: 'landing', landing: landingStore.getExportData() }

  downloadBlob(new Blob([JSON.stringify(worldPayload, null, 2)], { type: 'application/json' }), `世界观_世界框架_${ds}.json`)
  setTimeout(() => {
    downloadBlob(new Blob([JSON.stringify(continentsPayload, null, 2)], { type: 'application/json' }), `世界观_大陆叙事_${ds}.json`)
  }, 300)
  setTimeout(() => {
    downloadBlob(new Blob([JSON.stringify(landingPayload, null, 2)], { type: 'application/json' }), `世界观_落地文案_${ds}.json`)
  }, 600)
}

const exportDataSize = computed(() => {
  try {
    const data = {
      world: worldStore.getExportData(),
      continents: continentsStore.getExportData(),
      landing: landingStore.getExportData()
    }
    const size = new Blob([JSON.stringify(data)]).size
    return size
  } catch { return 0 }
})

const showSplitOption = computed(() => exportDataSize.value > 500 * 1024)

// ── 文件导入（带预览 + 自动快照 + 回滚） ────────────────

function handleImportClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string
        const data = JSON.parse(raw)
        showPreview(data)
      } catch (err) {
        importError.value = '文件解析失败，请确认是有效的JSON文件'
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function showPreview(data: Record<string, any>) {
  importError.value = ''
  importSuccess.value = false
  checksumMismatch.value = false

  // checksum 验证
  if ('checksum' in data && typeof data.checksum === 'string') {
    if (!verifyChecksum(data)) {
      checksumMismatch.value = true
    }
  }

  const result = validateImportData(data)
  validationResult.value = result
  pendingImportData.value = data
  importPreview.value = true
}

function confirmImport() {
  if (!pendingImportData.value) return
  const data = pendingImportData.value

  // 导入前自动快照
  try {
    const worldExport = worldStore.getExportData()
    const continentsExport = continentsStore.getExportData()
    const landingExport = landingStore.getExportData()
    historyStore.saveSnapshot(
      worldExport,
      continentsExport,
      landingExport,
      '导入前自动备份'
    )
  } catch (e) {
    console.warn('导入前快照保存失败:', e)
  }

  // 执行导入，失败则回滚
  try {
    if (data.world) worldStore.loadFromJSON(data.world)
    if (data.continents) continentsStore.loadFromJSON(data.continents)
    if (data.landing) landingStore.loadFromJSON(data.landing)

    importError.value = ''
    importSuccess.value = true
    importPreview.value = false
    pendingImportData.value = null
    validationResult.value = null
    setTimeout(() => { show.value = false; importSuccess.value = false }, 1500)
  } catch (err: any) {
    // 回滚到导入前的快照
    const backup = historyStore.records[0]
    if (backup) {
      try {
        worldStore.loadFromJSON(backup.data.world)
        continentsStore.loadFromJSON(backup.data.continents)
        landingStore.loadFromJSON(backup.data.landing)
      } catch { /* 回滚也失败则忽略 */ }
    }
    importError.value = `导入失败已自动回滚: ${err?.message || '未知错误'}`
    importPreview.value = false
  }
}

function cancelImport() {
  importPreview.value = false
  pendingImportData.value = null
  validationResult.value = null
  checksumMismatch.value = false
}

// ── 多文件合并导入 ───────────────────────────────────────

function pickMultiFile(target: 'world' | 'continents' | 'landing') {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (target === 'world') { multiWorldData.value = data.world || data; multiWorldFileName.value = file.name }
        else if (target === 'continents') { multiContinentsData.value = data.continents || data; multiContinentsFileName.value = file.name }
        else { multiLandingData.value = data.landing || data; multiLandingFileName.value = file.name }
      } catch {
        importError.value = `${file.name} 解析失败`
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function handleMultiImportPreview() {
  const merged: Record<string, any> = { version: 1 }
  if (multiWorldData.value) merged.world = multiWorldData.value
  if (multiContinentsData.value) merged.continents = multiContinentsData.value
  if (multiLandingData.value) merged.landing = multiLandingData.value

  if (!merged.world && !merged.continents && !merged.landing) {
    importError.value = '请至少选择一个文件'
    return
  }
  showPreview(merged)
}

function resetMultiFiles() {
  multiWorldData.value = null
  multiContinentsData.value = null
  multiLandingData.value = null
  multiWorldFileName.value = ''
  multiContinentsFileName.value = ''
  multiLandingFileName.value = ''
}

// ── 历史记录还原 ─────────────────────────────────────────

function handleRestoreFromHistory() {
  if (!selectedRecord.value) return
  // 还原前也做快照
  try {
    historyStore.saveSnapshot(
      worldStore.getExportData(),
      continentsStore.getExportData(),
      landingStore.getExportData(),
      '还原前自动备份'
    )
  } catch { /* ignore */ }

  const { world, continents, landing } = selectedRecord.value.data
  worldStore.loadFromJSON(world)
  continentsStore.loadFromJSON(continents)
  landingStore.loadFromJSON(landing)
  importError.value = ''
  importSuccess.value = true
  setTimeout(() => { show.value = false; importSuccess.value = false; selectedHistoryId.value = null }, 1500)
}

function handleDeleteHistory(id: string) {
  historyStore.deleteRecord(id)
  if (selectedHistoryId.value === id) selectedHistoryId.value = null
}

// ── 工具函数 ─────────────────────────────────────────────

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function dateSuffix() {
  return new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <NModal v-model:show="show" preset="card" :title="mode === 'export' ? '导出数据' : '导入数据'" style="max-width:560px;">
    <!-- ════════ 导出 ════════ -->
    <template v-if="mode === 'export'">
      <p style="margin-bottom:16px;color:var(--color-text-secondary);font-size:13px;">
        将所有三个章节的内容导出为JSON文件，可用于备份或分享给团队成员。
      </p>
      <NButton type="primary" block @click="handleExport">下载JSON文件</NButton>

      <template v-if="showSplitOption">
        <NDivider style="margin:12px 0;" />
        <p style="margin-bottom:8px;color:var(--color-text-secondary);font-size:13px;">
          当前数据量较大（{{ formatSize(exportDataSize) }}），可选择分阶段导出为3个文件：
        </p>
        <NButton block @click="handleExportSplit">分阶段导出（3个文件）</NButton>
      </template>

      <NDivider style="margin:12px 0;" />
      <p style="margin-bottom:8px;color:var(--color-text-secondary);font-size:13px;">
        导出为人可阅读的TXT文档，包含全部三个章节内容，无字符数限制。
      </p>
      <NButton block @click="handleExportTxt">下载TXT文档</NButton>

      <NAlert v-if="exportVerifyWarning" type="warning" style="margin-top:12px;" :title="exportVerifyWarning" />
    </template>

    <!-- ════════ 导入 ════════ -->
    <template v-else>
      <!-- 导入方式切换 -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <NButton :type="importMode === 'file' ? 'primary' : 'default'" size="small" @click="importMode = 'file'">本地文件导入</NButton>
        <NButton :type="importMode === 'multi' ? 'primary' : 'default'" size="small" @click="importMode = 'multi'">多文件合并导入</NButton>
        <NButton :type="importMode === 'history' ? 'primary' : 'default'" size="small" @click="importMode = 'history'">
          历史记录还原
          <span v-if="historyStore.records.length" style="margin-left:4px;font-size:11px;opacity:.7;">({{ historyStore.records.length }})</span>
        </NButton>
      </div>

      <NAlert v-if="importError" type="error" style="margin-bottom:12px;">{{ importError }}</NAlert>
      <NAlert v-if="importSuccess" type="success" style="margin-bottom:12px;">还原成功！</NAlert>

      <!-- ── 导入预览面板 ── -->
      <template v-if="importPreview && validationResult">
        <div style="background:var(--color-bg-secondary);border-radius:var(--radius-md);padding:16px;margin-bottom:12px;">
          <h4 style="margin:0 0 12px;font-size:15px;">导入数据预览</h4>

          <!-- checksum 不匹配 -->
          <NAlert v-if="checksumMismatch" type="warning" style="margin-bottom:8px;" title="校验和不匹配">
            文件内容可能被手动修改过，数据完整性无法保证。
          </NAlert>

          <!-- 错误列表 -->
          <NAlert v-if="validationResult.errors.length" type="error" title="发现以下错误" style="margin-bottom:8px;">
            <ul style="margin:4px 0;padding-left:20px;font-size:12px;">
              <li v-for="(err, i) in validationResult.errors.slice(0, 20)" :key="i">
                <code style="font-size:11px;">{{ err.path }}</code>：{{ err.message }}
              </li>
              <li v-if="validationResult.errors.length > 20" style="color:var(--color-text-tertiary);">
                ... 还有 {{ validationResult.errors.length - 20 }} 个错误
              </li>
            </ul>
          </NAlert>

          <!-- 警告列表 -->
          <NCollapse v-if="validationResult.warnings.length" style="margin-bottom:8px;">
            <NCollapseItem :title="`注意事项（${validationResult.warnings.length} 条）`" name="warnings">
              <ul style="margin:4px 0;padding-left:20px;font-size:12px;">
                <li v-for="(warn, i) in validationResult.warnings.slice(0, 30)" :key="i">
                  <code style="font-size:11px;">{{ warn.path }}</code>：{{ warn.message }}
                </li>
                <li v-if="validationResult.warnings.length > 30" style="color:var(--color-text-tertiary);">
                  ... 还有 {{ validationResult.warnings.length - 30 }} 条
                </li>
              </ul>
            </NCollapseItem>
          </NCollapse>

          <!-- 数据摘要 -->
          <div style="font-size:13px;line-height:2;">
            <p>
              <NTag size="small" type="info">世界观</NTag>
              字段填充：{{ validationResult.summary.worldFieldsFilled }} / {{ validationResult.summary.worldFieldsTotal }}
            </p>
            <p>
              <NTag size="small" type="success">大陆</NTag>
              {{ validationResult.summary.continentsWithData.join('、') || '无数据' }}
            </p>
            <p>
              <NTag size="small" type="warning">落地关卡</NTag>
              {{ validationResult.summary.landingWithData.join('、') || '无数据' }}
            </p>
            <p>
              <NTag size="small" :type="validationResult.summary.hasMetaData ? 'success' : 'default'">定稿信息</NTag>
              {{ validationResult.summary.hasMetaData ? '包含' : '不含（导入后为草稿状态）' }}
            </p>
            <p>
              <NTag size="small">版本</NTag>
              v{{ validationResult.summary.version }}
            </p>
          </div>

          <!-- 操作按钮 -->
          <NSpace style="margin-top:12px;">
            <NButton type="primary" @click="confirmImport" :disabled="validationResult.errors.length > 0">
              {{ validationResult.errors.length > 0 ? '存在错误，无法导入' : '确认导入' }}
            </NButton>
            <NButton @click="cancelImport">取消</NButton>
          </NSpace>
        </div>
      </template>

      <!-- ── 文件导入 ── -->
      <template v-if="importMode === 'file' && !importPreview">
        <p style="margin-bottom:12px;color:var(--color-text-secondary);font-size:13px;">
          从JSON文件导入数据，将覆盖当前所有内容。导入前会自动创建快照备份。
        </p>
        <NButton type="primary" block @click="handleImportClick">选择JSON文件导入</NButton>
      </template>

      <!-- ── 多文件合并导入 ── -->
      <template v-if="importMode === 'multi' && !importPreview">
        <p style="margin-bottom:12px;color:var(--color-text-secondary);font-size:13px;">
          分别选择世界框架、大陆叙事、落地文案文件进行合并导入（至少选择一个）。
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <NButton size="small" @click="pickMultiFile('world')" style="min-width:120px;">世界框架文件</NButton>
            <span style="font-size:12px;color:var(--color-text-secondary);">{{ multiWorldFileName || '未选择' }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <NButton size="small" @click="pickMultiFile('continents')" style="min-width:120px;">大陆叙事文件</NButton>
            <span style="font-size:12px;color:var(--color-text-secondary);">{{ multiContinentsFileName || '未选择' }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <NButton size="small" @click="pickMultiFile('landing')" style="min-width:120px;">落地文案文件</NButton>
            <span style="font-size:12px;color:var(--color-text-secondary);">{{ multiLandingFileName || '未选择' }}</span>
          </div>
        </div>
        <NSpace>
          <NButton type="primary" @click="handleMultiImportPreview" :disabled="!multiWorldData && !multiContinentsData && !multiLandingData">
            预览并验证
          </NButton>
          <NButton @click="resetMultiFiles">清除选择</NButton>
        </NSpace>
      </template>

      <!-- ── 历史记录还原 ── -->
      <template v-if="importMode === 'history' && !importPreview">
        <p style="margin-bottom:12px;color:var(--color-text-secondary);font-size:13px;">
          每次AI生成后自动保存的快照，最多保留50条。选择记录后点击还原。
        </p>

        <template v-if="historyStore.records.length === 0">
          <div style="text-align:center;color:var(--color-text-tertiary);font-size:13px;padding:20px 0;">
            暂无历史记录，AI生成后将自动保存快照
          </div>
        </template>

        <template v-else>
          <NSelect
            v-model:value="selectedHistoryId"
            :options="historyOptions"
            placeholder="选择要还原的历史快照..."
            clearable
            style="margin-bottom:12px;"
          />

          <template v-if="selectedRecord">
            <div style="background:var(--color-bg-secondary);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--color-text-secondary);">
              <div>📅 保存时间：{{ formatTime(selectedRecord.timestamp) }}</div>
              <div style="margin-top:4px;">📝 {{ selectedRecord.title }}</div>
            </div>
            <NSpace justify="end" style="margin-bottom:4px;">
              <NPopconfirm @positive-click="handleDeleteHistory(selectedRecord!.id)">
                <template #trigger>
                  <NButton size="small" type="error" ghost>删除此记录</NButton>
                </template>
                确定要删除这条历史记录吗？
              </NPopconfirm>
              <NButton type="primary" size="small" @click="handleRestoreFromHistory">还原此快照</NButton>
            </NSpace>
          </template>

          <NDivider style="margin:8px 0;" />
          <div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:6px;">最近记录（共 {{ historyStore.records.length }} 条）：</div>
          <div style="max-height:180px;overflow-y:auto;">
            <div
              v-for="rec in historyStore.records.slice(0, 20)"
              :key="rec.id"
              style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:12px;transition:background .15s;"
              :style="selectedHistoryId === rec.id ? 'background:var(--color-primary-light,rgba(99,102,241,.1));' : ''"
              @click="selectedHistoryId = rec.id"
            >
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ rec.title }}</span>
              <NPopconfirm @positive-click="handleDeleteHistory(rec.id)">
                <template #trigger>
                  <NButton size="tiny" quaternary type="error" @click.stop>✕</NButton>
                </template>
                确定删除？
              </NPopconfirm>
            </div>
          </div>
        </template>
      </template>
    </template>
  </NModal>
</template>
