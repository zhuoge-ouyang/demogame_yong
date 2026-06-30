import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const RULES_PATH = path.join(ROOT_DIR, 'src', 'services', 'canon-rules.json')

export const DEFAULT_AUDIT_FILES = [
  'data/world.json',
  'data/world-avatar.json',
  'data/continents.json',
  'data/continents-avatar.json',
  'src/services/prompts',
  'src/constants/defaults.ts'
]

const PROMPT_GUARD_WORDS = [
  '禁止',
  '不要',
  '不涉及',
  '不再',
  '不能',
  '不可',
  '避免',
  '非',
  '不是',
  '而非',
  '禁用',
  '已毁坏',
  '未来神界'
]

export function loadCanonRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')).rules
}

export function findCanonViolations(text, filePath = '<text>', rules = loadCanonRules()) {
  const violations = []
  for (const rule of rules) {
    let index = text.indexOf(rule.term)
    while (index !== -1) {
      const location = locateIndex(text, index)
      violations.push({
        filePath,
        ruleId: rule.id,
        term: rule.term,
        severity: rule.severity,
        replacement: rule.replacement,
        message: rule.message,
        index,
        line: location.line,
        column: location.column,
        lineText: location.lineText
      })
      index = text.indexOf(rule.term, index + rule.term.length)
    }
  }
  return violations
}

export function auditFiles(entries = DEFAULT_AUDIT_FILES, options = {}) {
  const rootDir = options.rootDir || ROOT_DIR
  const rules = options.rules || loadCanonRules()
  const files = entries.flatMap(entry => collectFiles(path.resolve(rootDir, entry)))
  const violations = []
  const ignored = []

  for (const file of files) {
    const relativePath = path.relative(rootDir, file).replaceAll(path.sep, '/')
    const text = fs.readFileSync(file, 'utf8')
    const fileViolations = findCanonViolations(text, relativePath, rules)
    for (const violation of fileViolations) {
      if (shouldIgnoreViolation(violation, relativePath, text)) {
        ignored.push(violation)
      } else {
        violations.push(violation)
      }
    }
  }

  violations.sort(compareViolations)
  return { files, violations, ignored }
}

export function formatViolation(violation) {
  return [
    `${violation.filePath}:${violation.line}:${violation.column}`,
    `命中 "${violation.term}"`,
    `建议替换为 "${violation.replacement}"`,
    violation.message
  ].join(' | ')
}

function collectFiles(entryPath) {
  if (!fs.existsSync(entryPath)) return []
  const stat = fs.statSync(entryPath)
  if (stat.isFile()) return [entryPath]
  if (!stat.isDirectory()) return []

  const files = []
  for (const name of fs.readdirSync(entryPath)) {
    const child = path.join(entryPath, name)
    const childStat = fs.statSync(child)
    if (childStat.isDirectory()) {
      files.push(...collectFiles(child))
    } else if (/\.(ts|json)$/.test(name)) {
      files.push(child)
    }
  }
  return files
}

function locateIndex(text, index) {
  const before = text.slice(0, index)
  const line = before.split('\n').length
  const lastNewline = before.lastIndexOf('\n')
  const column = index - lastNewline
  const lineStart = lastNewline + 1
  const nextNewline = text.indexOf('\n', index)
  const lineEnd = nextNewline === -1 ? text.length : nextNewline
  return {
    line,
    column,
    lineText: text.slice(lineStart, lineEnd).trim()
  }
}

function shouldIgnoreViolation(violation, relativePath, text) {
  if (!relativePath.startsWith('src/services/prompts/')) return false
  if (violation.ruleId === 'no-corrupt-output-marker') return false

  const context = getLineWindow(text, violation.line, 2)
  return PROMPT_GUARD_WORDS.some(word => context.includes(word))
}

function getLineWindow(text, lineNumber, radius) {
  const lines = text.split('\n')
  const start = Math.max(0, lineNumber - 1 - radius)
  const end = Math.min(lines.length, lineNumber + radius)
  return lines.slice(start, end).join('\n')
}

function compareViolations(a, b) {
  if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath)
  if (a.line !== b.line) return a.line - b.line
  return a.column - b.column
}

function runCli() {
  const { violations, ignored } = auditFiles()
  if (violations.length === 0) {
    const ignoredNote = ignored.length > 0 ? `（已忽略 ${ignored.length} 处 prompt 负向约束用语）` : ''
    console.log(`Canon audit passed. ${ignoredNote}`)
    return
  }

  console.error(`Canon audit failed: ${violations.length} violation(s).`)
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`)
  }
  process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli()
}
