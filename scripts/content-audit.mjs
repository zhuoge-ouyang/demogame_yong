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

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Phase2 content audit: ${report.continentCount} continents, ${report.aspectCount} aspects, ${report.errorCount} errors, ${report.warningCount} warnings.`)
    for (const issue of report.issues) {
      console.log(`- ${formatContentIssue(issue)}`)
    }
  }

  if (report.errorCount > 0 || (strict && report.warningCount > 0)) {
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli()
}
