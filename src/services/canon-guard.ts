import canonRulesData from './canon-rules.json'

export type CanonSeverity = 'error' | 'warning'

export interface CanonRule {
  id: string
  term: string
  severity: CanonSeverity
  replacement: string
  message: string
}

export interface CanonViolation {
  ruleId: string
  term: string
  severity: CanonSeverity
  replacement: string
  message: string
  index: number
}

const canonRules = canonRulesData.rules as CanonRule[]

export function getCanonRules(): CanonRule[] {
  return canonRules
}

export function findCanonViolations(text: string): CanonViolation[] {
  if (!text) return []

  const violations: CanonViolation[] = []
  for (const rule of canonRules) {
    let index = text.indexOf(rule.term)
    while (index !== -1) {
      violations.push({
        ruleId: rule.id,
        term: rule.term,
        severity: rule.severity,
        replacement: rule.replacement,
        message: rule.message,
        index
      })
      index = text.indexOf(rule.term, index + rule.term.length)
    }
  }
  return violations
}

export function getFatalCanonViolations(text: string): CanonViolation[] {
  return findCanonViolations(text).filter(v => v.severity === 'error')
}

export function formatCanonViolationSummary(violations: CanonViolation[], maxItems = 5): string {
  const seen = new Set<string>()
  const parts: string[] = []

  for (const violation of violations) {
    if (seen.has(violation.ruleId)) continue
    seen.add(violation.ruleId)
    parts.push(`${violation.term} -> ${violation.replacement}`)
    if (parts.length >= maxItems) break
  }

  const restCount = seen.size < violations.length ? violations.length - seen.size : 0
  return restCount > 0 ? `${parts.join('；')}；另有 ${restCount} 处` : parts.join('；')
}
