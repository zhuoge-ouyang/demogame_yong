import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

export const PHASE2_ASPECTS = [
  'mainPlot',
  'coreConflict',
  'playerGoal',
  'experiencePositioning',
  'inGameExpression',
  'themeExpression',
  'playerProgressionChanges'
]

export const PHASE2_ASPECT_LABELS = {
  mainPlot: '主线剧情',
  coreConflict: '核心冲突',
  playerGoal: '玩家目标',
  experiencePositioning: '体验定位',
  inGameExpression: '剧情呈现方式',
  themeExpression: '主题表达',
  playerProgressionChanges: '剧情推进变化'
}

const MIN_PACKAGE_CHARS = 1900
const MAX_PACKAGE_CHARS = 2700

const FIELD_LENGTH_TARGETS = {
  mainPlot: { min: 520, max: 720 },
  coreConflict: { min: 200, max: 300 },
  playerGoal: { min: 200, max: 320 },
  experiencePositioning: { min: 200, max: 320 },
  inGameExpression: { min: 320, max: 500 },
  themeExpression: { min: 160, max: 260 },
  playerProgressionChanges: { min: 280, max: 420 }
}

const FIELD_BALANCE_TOLERANCE = {
  minRatio: 0.75,
  maxRatio: 1.25
}

const PACKAGE_ANCHORS = [
  {
    id: 'player-action',
    source: 'package',
    min: 3,
    terms: ['玩家', '探索', '协助', '击败', '守住', '修复', '揭露', '收集', '招募', '解锁', '帮助', '稳定', '深入', '穿越', '保护'],
    label: '玩家动作'
  },
  {
    id: 'gameplay-landing',
    source: 'inGameExpression',
    min: 2,
    terms: ['探索', '城防', '守城', 'Boss', 'NPC', '地图', '区域', '战斗', '关卡', '灾厄', '防御塔', '玩法', '解谜', '潜入', '环境线索', '决战'],
    label: '游戏落地'
  },
  {
    id: 'progression-change',
    source: 'playerProgressionChanges',
    min: 2,
    terms: ['解锁', '通关', '变化', '开放', '获得', '招募', '推进', '阶段', '进入', '安全区', '防御塔', '玩法', '理解'],
    label: '推进变化'
  }
]

const PACKAGE_ANCHOR_SOURCES = {
  package: PHASE2_ASPECTS
}

export function auditPhase2Continents(state) {
  const issues = []
  const continentEntries = Object.entries(state || {})

  for (const [continentId, continent] of continentEntries) {
    const aspectValues = {}

    for (const aspectKey of PHASE2_ASPECTS) {
      const value = normalizeText(continent?.aspects?.[aspectKey])
      aspectValues[aspectKey] = value
      if (!value) {
        issues.push(makeIssue({
          severity: 'error',
          ruleId: 'phase2-aspect-required',
          continentId,
          continentName: continent?.name || continentId,
          aspectKey,
          message: `${PHASE2_ASPECT_LABELS[aspectKey]}为空，无法形成可审阅的大陆包。`
        }))
        continue
      }

      const target = FIELD_LENGTH_TARGETS[aspectKey]
      const minAllowed = target ? Math.floor(target.min * FIELD_BALANCE_TOLERANCE.minRatio) : 0
      const maxAllowed = target ? Math.ceil(target.max * FIELD_BALANCE_TOLERANCE.maxRatio) : Infinity
      if (target && (value.length < minAllowed || value.length > maxAllowed)) {
        issues.push(makeIssue({
          severity: 'warning',
          ruleId: 'phase2-field-balance',
          continentId,
          continentName: continent?.name || continentId,
          aspectKey,
          message: `${PHASE2_ASPECT_LABELS[aspectKey]}为 ${value.length} 字，建议保持在 ${target.min}-${target.max} 字，避免大陆包失衡。`
        }))
      }
    }

    if (Object.values(aspectValues).some(Boolean)) {
      const packageText = PHASE2_ASPECTS.map(aspectKey => aspectValues[aspectKey] || '').join('')
      if (packageText.length < MIN_PACKAGE_CHARS) {
        issues.push(makeIssue({
          severity: 'warning',
          ruleId: 'phase2-package-depth',
          continentId,
          continentName: continent?.name || continentId,
          aspectKey: 'mainPlot',
          message: `大陆故事包合计 ${packageText.length} 字，建议补到 ${MIN_PACKAGE_CHARS}-${MAX_PACKAGE_CHARS} 字，方便甲方完整判断。`
        }))
      }

      if (packageText.length > MAX_PACKAGE_CHARS) {
        issues.push(makeIssue({
          severity: 'warning',
          ruleId: 'phase2-package-too-long',
          continentId,
          continentName: continent?.name || continentId,
          aspectKey: 'mainPlot',
          message: `大陆故事包合计 ${packageText.length} 字，建议压到 ${MIN_PACKAGE_CHARS}-${MAX_PACKAGE_CHARS} 字，避免故事过长。`
        }))
      }

      for (const anchorRule of PACKAGE_ANCHORS) {
        const sourceKeys = PACKAGE_ANCHOR_SOURCES[anchorRule.source] || [anchorRule.source]
        const sourceText = sourceKeys.map(key => aspectValues[key] || '').join('')
        const hitCount = countAnchorHits(sourceText, anchorRule.terms)
        if (hitCount < anchorRule.min) {
          issues.push(makeIssue({
            severity: 'warning',
            ruleId: 'phase2-package-anchor',
            continentId,
            continentName: continent?.name || continentId,
            aspectKey: sourceKeys[0] || 'mainPlot',
            message: `大陆故事包缺少${anchorRule.label}锚点，甲方难以判断如何落地。`
          }))
        }
      }
    }
  }

  return {
    continentCount: continentEntries.length,
    aspectCount: continentEntries.length * PHASE2_ASPECTS.length,
    errorCount: issues.filter(issue => issue.severity === 'error').length,
    warningCount: issues.filter(issue => issue.severity === 'warning').length,
    issues
  }
}

export function auditPhase3Landing(state) {
  const issues = []
  const continentEntries = Object.entries(state || {})
  let startedCount = 0

  for (const [continentId, continent] of continentEntries) {
    const contentValues = [
      continent?.systemDialogue?.opening,
      ...(continent?.systemDialogue?.actNodes || []),
      ...(continent?.bosses || []).flatMap(boss => [boss.name, boss.identity, boss.motivation, boss.signatureLine]),
      ...(continent?.levelNodes || []).flatMap(node => [node.storyPurpose, node.entryPrompt, node.completionFeedback, node.narrativeReward])
    ].map(normalizeText)
    if (!contentValues.some(Boolean)) continue
    startedCount++

    if (!Array.isArray(continent?.bosses) || continent.bosses.length !== 3) {
      issues.push(makePhase3Issue('error', 'phase3-boss-count', continentId, 'Boss设计', '每个大陆必须固定配置3名关键Boss。'))
    }
    if (!Array.isArray(continent?.levelNodes) || continent.levelNodes.length !== 9) {
      issues.push(makePhase3Issue('error', 'phase3-region-count', continentId, '区域文案', '每个大陆必须固定配置9个区域。'))
    }

    const dialogueEntries = [
      ['开场对白', continent?.systemDialogue?.opening],
      ...(continent?.systemDialogue?.actNodes || []).map((value, index) => [`第${index + 1}幕节点`, value])
    ]
    for (const [label, value] of dialogueEntries) {
      checkPhase3ShortCopy(issues, continentId, label, value)
    }

    ;(continent?.bosses || []).forEach((boss, index) => {
      const expectedArea = (index + 1) * 3
      if (boss.areaIndex !== expectedArea) {
        issues.push(makePhase3Issue('error', 'phase3-boss-position', continentId, `Boss${index + 1}`, `Boss必须位于第${expectedArea}区域。`))
      }
      for (const [field, label] of [['name', '名字'], ['identity', '身份'], ['motivation', '动机']]) {
        if (!normalizeText(boss[field])) {
          issues.push(makePhase3Issue('warning', 'phase3-boss-field-required', continentId, `Boss${index + 1}·${label}`, '字段尚未填写。'))
        }
      }
      checkPhase3ShortCopy(issues, continentId, `Boss${index + 1}·一句话台词`, boss.signatureLine)
    })

    ;(continent?.levelNodes || []).forEach((node, index) => {
      const expectedAct = Math.floor(index / 3) + 1
      if (node.act !== expectedAct) {
        issues.push(makePhase3Issue('error', 'phase3-act-order', continentId, `区域${index + 1}`, `该区域必须归入第${expectedAct}幕。`))
      }
      for (const [field, label] of [['storyPurpose', '叙事任务'], ['narrativeReward', '叙事线索']]) {
        if (!normalizeText(node[field])) {
          issues.push(makePhase3Issue('warning', 'phase3-region-field-required', continentId, `区域${index + 1}·${label}`, '字段尚未填写。'))
        }
      }
      checkPhase3ShortCopy(issues, continentId, `区域${index + 1}·进入前提示`, node.entryPrompt)
      checkPhase3ShortCopy(issues, continentId, `区域${index + 1}·结束后反馈`, node.completionFeedback)
    })
  }

  return {
    continentCount: continentEntries.length,
    startedCount,
    errorCount: issues.filter(issue => issue.severity === 'error').length,
    warningCount: issues.filter(issue => issue.severity === 'warning').length,
    issues
  }
}

export function formatContentIssue(issue) {
  const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN'
  return `[${prefix}] ${issue.continentName}(${issue.continentId}) / ${issue.aspectLabel}: ${issue.message}`
}

function makeIssue(issue) {
  return {
    aspectLabel: PHASE2_ASPECT_LABELS[issue.aspectKey] || issue.aspectKey,
    ...issue
  }
}

function makePhase3Issue(severity, ruleId, continentId, aspectLabel, message) {
  return {
    severity,
    ruleId,
    continentId,
    continentName: continentId === 'jin' ? '金耀大陆' : continentId === 'bing' ? '霜寒大陆' : continentId === 'huo' ? '炎狱大陆' : continentId,
    aspectKey: aspectLabel,
    aspectLabel,
    message
  }
}

function checkPhase3ShortCopy(issues, continentId, label, value) {
  const normalized = normalizeText(value)
  if (!normalized) {
    issues.push(makePhase3Issue('warning', 'phase3-short-copy-required', continentId, label, '短句尚未填写。'))
    return
  }
  const length = [...normalized].length
  if (length < 20 || length > 40) {
    issues.push(makePhase3Issue('warning', 'phase3-short-copy-length', continentId, label, `当前为${length}字，甲方要求保持在20-40字。`))
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : ''
}

function countAnchorHits(text, terms) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0)
}

function runCli() {
  const strict = process.argv.includes('--strict')
  const json = process.argv.includes('--json')
  const filePath = path.join(ROOT_DIR, 'data', 'continents.json')
  const state = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const report = auditPhase2Continents(state)
  const landingPath = path.join(ROOT_DIR, 'data', 'landing.json')
  const landingState = JSON.parse(fs.readFileSync(landingPath, 'utf8'))
  const phase3Report = auditPhase3Landing(landingState)

  if (json) {
    console.log(JSON.stringify({ phase2: report, phase3: phase3Report }, null, 2))
  } else {
    console.log(`Phase2 content audit: ${report.continentCount} continents, ${report.aspectCount} aspects, ${report.errorCount} errors, ${report.warningCount} warnings.`)
    for (const issue of report.issues) {
      console.log(`- ${formatContentIssue(issue)}`)
    }
    console.log(`Phase3 content audit: ${phase3Report.startedCount}/${phase3Report.continentCount} continents started, ${phase3Report.errorCount} errors, ${phase3Report.warningCount} warnings.`)
    for (const issue of phase3Report.issues) {
      console.log(`- ${formatContentIssue(issue)}`)
    }
  }

  const errorCount = report.errorCount + phase3Report.errorCount
  const warningCount = report.warningCount + phase3Report.warningCount
  if (errorCount > 0 || (strict && warningCount > 0)) {
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli()
}
