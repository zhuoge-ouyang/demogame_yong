/**
 * 导入数据深度验证工具
 * 对 JSON 导入数据进行结构、类型、完整性校验
 */

// ─── 类型定义 ────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  summary: ImportSummary
}

export interface ValidationError {
  path: string
  message: string
  type: 'missing' | 'type_error' | 'structure_error'
}

export interface ValidationWarning {
  path: string
  message: string
  type: 'empty_field' | 'unknown_field' | 'version_mismatch'
}

export interface ImportSummary {
  worldFieldsFilled: number
  worldFieldsTotal: number
  continentsWithData: string[]
  landingWithData: string[]
  hasMetaData: boolean
  version: number
}

// ─── 常量 ────────────────────────────────────────────────

const CONTINENT_IDS = ['jin', 'mu', 'bing', 'huo', 'tu', 'feng', 'lei', 'guang', 'an'] as const
const LANDING_IDS = ['jin', 'bing', 'huo'] as const
const CONTINENT_NAME_MAP: Record<string, string> = {
  jin: '金耀大陆', mu: '翠森大陆', bing: '霜寒大陆', huo: '炎狱大陆',
  tu: '磐岩大陆', feng: '风语大陆', lei: '雷霆大陆', guang: '圣光大陆', an: '暗影大陆'
}

// ─── 辅助函数 ────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function checkStringField(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): boolean {
  if (!(field in obj)) {
    warnings.push({ path: `${path}.${field}`, message: `字段缺失`, type: 'empty_field' })
    return false
  }
  if (!isString(obj[field])) {
    errors.push({ path: `${path}.${field}`, message: `期望 string 类型，得到 ${typeof obj[field]}`, type: 'type_error' })
    return false
  }
  return (obj[field] as string).trim().length > 0
}

function checkObjectField(
  obj: Record<string, unknown>,
  field: string,
  path: string,
  errors: ValidationError[]
): Record<string, unknown> | null {
  if (!(field in obj)) {
    errors.push({ path: `${path}.${field}`, message: '缺少必要对象字段', type: 'missing' })
    return null
  }
  if (!isObject(obj[field])) {
    errors.push({ path: `${path}.${field}`, message: `期望 object 类型，得到 ${typeof obj[field]}`, type: 'type_error' })
    return null
  }
  return obj[field] as Record<string, unknown>
}

// ─── 核心验证逻辑 ────────────────────────────────────────

function validateRealmStructure(
  world: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  let filled = 0
  let total = 0
  const rs = checkObjectField(world, 'realmStructure', 'world', errors)
  if (!rs) return 0

  // summary
  total++
  if (checkStringField(rs, 'summary', 'world.realmStructure', errors, warnings)) filled++

  // upper / mortal / abyss
  for (const realm of ['upper', 'mortal', 'abyss'] as const) {
    const r = checkObjectField(rs, realm, `world.realmStructure`, errors)
    if (!r) { total += 3; continue }
    for (const tf of ['past', 'present', 'future'] as const) {
      total++
      if (checkStringField(r, tf, `world.realmStructure.${realm}`, errors, warnings)) filled++
    }
  }
  return filled
}

function validateMainStoryline(
  world: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  let filled = 0
  let total = 0
  const ms = checkObjectField(world, 'mainStoryline', 'world', errors)
  if (!ms) return 0

  // overview
  total++
  if (checkStringField(ms, 'overview', 'world.mainStoryline', errors, warnings)) filled++

  // stages
  if (!('stages' in ms) || !Array.isArray(ms.stages)) {
    errors.push({ path: 'world.mainStoryline.stages', message: '期望 array 类型', type: 'type_error' })
    return filled
  }
  const stages = ms.stages as unknown[]
  if (stages.length < 3) {
    warnings.push({ path: 'world.mainStoryline.stages', message: `期望3个阶段，当前${stages.length}个`, type: 'empty_field' })
  }
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]
    if (!isObject(s)) {
      errors.push({ path: `world.mainStoryline.stages[${i}]`, message: '期望 object 类型', type: 'type_error' })
      total += 4
      continue
    }
    const so = s as Record<string, unknown>
    for (const f of ['name', 'goal', 'events', 'resolution'] as const) {
      total++
      if (checkStringField(so, f, `world.mainStoryline.stages[${i}]`, errors, warnings)) filled++
    }
  }
  return filled
}

function validatePlayerIdentity(
  world: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  let filled = 0
  let total = 0
  const pi = checkObjectField(world, 'playerIdentity', 'world', errors)
  if (!pi) return 0

  for (const f of ['origin', 'initialPerception', 'revelationArc', 'gameplayIntegration'] as const) {
    total++
    if (checkStringField(pi, f, 'world.playerIdentity', errors, warnings)) filled++
  }
  return filled
}

function validateHeroSystem(
  world: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  let filled = 0
  let total = 0
  if (!('heroSystem' in world) || !Array.isArray(world.heroSystem)) {
    errors.push({ path: 'world.heroSystem', message: '期望 array 类型', type: 'type_error' })
    return 0
  }
  const heroes = world.heroSystem as unknown[]
  if (heroes.length !== 9) {
    warnings.push({ path: 'world.heroSystem', message: `期望9个英雄，当前${heroes.length}个`, type: 'empty_field' })
  }
  for (let i = 0; i < heroes.length; i++) {
    const h = heroes[i]
    if (!isObject(h)) {
      errors.push({ path: `world.heroSystem[${i}]`, message: '期望 object 类型', type: 'type_error' })
      total += 4
      continue
    }
    const ho = h as Record<string, unknown>
    for (const f of ['id', 'name', 'element', 'continent', 'visual', 'backstory', 'personality', 'role', 'joinCondition', 'joinStage', 'storyRole'] as const) {
      total++
      if (checkStringField(ho, f, `world.heroSystem[${i}]`, errors, warnings)) filled++
    }
  }
  return filled
}

function validateCastleGoddess(
  world: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  let filled = 0
  let total = 0
  const cg = checkObjectField(world, 'castleGoddess', 'world', errors)
  if (!cg) return 0

  const castle = checkObjectField(cg, 'castle', 'world.castleGoddess', errors)
  if (castle) {
    for (const f of ['description', 'role', 'significance'] as const) {
      total++
      if (checkStringField(castle, f, 'world.castleGoddess.castle', errors, warnings)) filled++
    }
  } else {
    total += 3
  }

  const goddess = checkObjectField(cg, 'goddess', 'world.castleGoddess', errors)
  if (goddess) {
    for (const f of ['name', 'appearance', 'personality', 'trueNature', 'guidanceStyle', 'dialogueThemes', 'truthMatrix'] as const) {
      total++
      if (checkStringField(goddess, f, 'world.castleGoddess.goddess', errors, warnings)) filled++
    }
  } else {
    total += 7
  }
  return filled
}

function validateWorldTreeSystem(
  world: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): number {
  let filled = 0
  let total = 0
  const wt = checkObjectField(world, 'worldTreeSystem', 'world', errors)
  if (!wt) return 0

  for (const f of ['growthMechanism', 'resourceContribution', 'unlockedFeatures', 'fourthForce', 'runeConnection'] as const) {
    total++
    if (checkStringField(wt, f, 'world.worldTreeSystem', errors, warnings)) filled++
  }
  return filled
}

function validateContinents(
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): string[] {
  const withData: string[] = []
  if (!isObject(data.continents)) {
    errors.push({ path: 'continents', message: '缺少 continents 对象或格式不正确', type: 'missing' })
    return withData
  }
  const continents = data.continents as Record<string, unknown>

  for (const cid of CONTINENT_IDS) {
    if (!(cid in continents)) {
      warnings.push({ path: `continents.${cid}`, message: `缺少大陆 ${CONTINENT_NAME_MAP[cid] || cid} 数据`, type: 'empty_field' })
      continue
    }
    if (!isObject(continents[cid])) {
      errors.push({ path: `continents.${cid}`, message: '期望 object 类型', type: 'type_error' })
      continue
    }
    const c = continents[cid] as Record<string, unknown>
    const aspects = checkObjectField(c, 'aspects', `continents.${cid}`, errors)
    if (!aspects) continue

    let hasSomeContent = false
    for (const f of ['mainPlot', 'coreConflict', 'playerGoal', 'experiencePositioning', 'inGameExpression', 'themeExpression', 'playerProgressionChanges'] as const) {
      const tmpW: ValidationWarning[] = []
      if (checkStringField(aspects, f, `continents.${cid}.aspects`, errors, tmpW)) {
        hasSomeContent = true
      }
    }
    if (hasSomeContent) withData.push(CONTINENT_NAME_MAP[cid] || cid)
  }
  return withData
}

function validateLanding(
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): string[] {
  const withData: string[] = []
  if (!isObject(data.landing)) {
    errors.push({ path: 'landing', message: '缺少 landing 对象或格式不正确', type: 'missing' })
    return withData
  }
  const landing = data.landing as Record<string, unknown>

  for (const lid of LANDING_IDS) {
    if (!(lid in landing)) {
      warnings.push({ path: `landing.${lid}`, message: `缺少 ${CONTINENT_NAME_MAP[lid] || lid} 落地数据`, type: 'empty_field' })
      continue
    }
    if (!isObject(landing[lid])) {
      errors.push({ path: `landing.${lid}`, message: '期望 object 类型', type: 'type_error' })
      continue
    }
    const lc = landing[lid] as Record<string, unknown>
    let hasSomeContent = false

    // systemDialogue
    const dialogue = isObject(lc.systemDialogue) ? lc.systemDialogue as Record<string, unknown> : null
    if (dialogue) {
      const tmpW: ValidationWarning[] = []
      if (checkStringField(dialogue, 'opening', `landing.${lid}.systemDialogue`, errors, tmpW)) hasSomeContent = true
      if (Array.isArray(dialogue.actNodes)) {
        for (let i = 0; i < dialogue.actNodes.length; i++) {
          const value = dialogue.actNodes[i]
          if (typeof value !== 'string') {
            errors.push({ path: `landing.${lid}.systemDialogue.actNodes[${i}]`, message: '期望 string 类型', type: 'type_error' })
          } else if (value.trim()) {
            hasSomeContent = true
          }
        }
      }
    }

    // 兼容识别旧版大陆级文本，实际载入后由 store 迁移
    const legacyEntry = isObject(lc.entryPrompt) ? lc.entryPrompt as Record<string, unknown> : null
    if (legacyEntry) {
      for (const f of ['narrative', 'npcDialogue', 'atmosphere']) {
        const tmpW: ValidationWarning[] = []
        if (checkStringField(legacyEntry, f, `landing.${lid}.entryPrompt`, errors, tmpW)) hasSomeContent = true
      }
    }

    // bosses
    if (Array.isArray(lc.bosses)) {
      for (let i = 0; i < (lc.bosses as unknown[]).length; i++) {
        const b = (lc.bosses as unknown[])[i]
        if (isObject(b)) {
          const bo = b as Record<string, unknown>
          const tmpW: ValidationWarning[] = []
          if (checkStringField(bo, 'name', `landing.${lid}.bosses[${i}]`, errors, tmpW)) hasSomeContent = true
        }
      }
    }

    // levelNodes
    if (Array.isArray(lc.levelNodes)) {
      for (let i = 0; i < (lc.levelNodes as unknown[]).length; i++) {
        const n = (lc.levelNodes as unknown[])[i]
        if (isObject(n)) {
          const no = n as Record<string, unknown>
          const tmpW: ValidationWarning[] = []
          for (const field of ['storyPurpose', 'entryPrompt', 'completionFeedback', 'narrativeReward']) {
            if (checkStringField(no, field, `landing.${lid}.levelNodes[${i}]`, errors, tmpW)) hasSomeContent = true
          }
        }
      }
    }

    if (hasSomeContent) withData.push(CONTINENT_NAME_MAP[lid] || lid)
  }
  return withData
}

// ─── 计算 world 总字段数 ─────────────────────────────────

function countWorldTotalFields(data: Record<string, unknown>): number {
  let total = 0
  // realmStructure: summary + 3 realms * 3 fields = 10
  total += 10
  // mainStoryline: overview + stages
  total += 1
  if (isObject(data.world)) {
    const w = data.world as Record<string, unknown>
    if (isObject(w.mainStoryline)) {
      const ms = w.mainStoryline as Record<string, unknown>
      if (Array.isArray(ms.stages)) total += (ms.stages as unknown[]).length * 4
      else total += 12
    } else {
      total += 12
    }
    // heroSystem
    if (Array.isArray(w.heroSystem)) total += (w.heroSystem as unknown[]).length * 11
    else total += 99
  } else {
    total += 12 + 99
  }
  // playerIdentity: 4
  total += 4
  // castleGoddess: 3 + 7 = 10
  total += 10
  // worldTreeSystem: 5
  total += 5
  return total
}

// ─── 主入口 ──────────────────────────────────────────────

export function validateImportData(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  let worldFieldsFilled = 0

  // 基本类型检查
  if (!isObject(data)) {
    errors.push({ path: '(root)', message: '数据格式无效，期望 JSON 对象', type: 'structure_error' })
    return {
      valid: false, errors, warnings,
      summary: { worldFieldsFilled: 0, worldFieldsTotal: 0, continentsWithData: [], landingWithData: [], hasMetaData: false, version: 0 }
    }
  }
  const d = data as Record<string, unknown>

  // 版本
  const version = typeof d.version === 'number' ? d.version : 1
  if (!('version' in d)) {
    warnings.push({ path: 'version', message: '未找到版本字段，视为 v1', type: 'version_mismatch' })
  }

  // 顶级字段
  if (!isObject(d.world)) {
    errors.push({ path: 'world', message: '缺少 world 对象或格式不正确', type: 'missing' })
  }
  if (!isObject(d.continents)) {
    errors.push({ path: 'continents', message: '缺少 continents 对象或格式不正确', type: 'missing' })
  }
  if (!isObject(d.landing)) {
    errors.push({ path: 'landing', message: '缺少 landing 对象或格式不正确', type: 'missing' })
  }

  // 如果顶级字段缺失太多，直接返回
  if (errors.length >= 2) {
    return {
      valid: false, errors, warnings,
      summary: { worldFieldsFilled: 0, worldFieldsTotal: 0, continentsWithData: [], landingWithData: [], hasMetaData: false, version }
    }
  }

  // World 深度验证
  if (isObject(d.world)) {
    const world = d.world as Record<string, unknown>
    worldFieldsFilled += validateRealmStructure(world, errors, warnings)
    worldFieldsFilled += validateMainStoryline(world, errors, warnings)
    worldFieldsFilled += validatePlayerIdentity(world, errors, warnings)
    worldFieldsFilled += validateHeroSystem(world, errors, warnings)
    worldFieldsFilled += validateCastleGoddess(world, errors, warnings)
    worldFieldsFilled += validateWorldTreeSystem(world, errors, warnings)

    // _meta 兼容性
    if ('_meta' in world) {
      if (!isObject(world._meta)) {
        warnings.push({ path: 'world._meta', message: '_meta 格式不正确，将使用默认值', type: 'unknown_field' })
      }
    } else {
      warnings.push({ path: 'world._meta', message: '不含定稿元数据（_meta），导入后将重置为草稿状态', type: 'version_mismatch' })
    }
  }

  // Continents 验证
  const continentsWithData = validateContinents(d, errors, warnings)

  // Landing 验证
  const landingWithData = validateLanding(d, errors, warnings)

  // 检查是否有 _meta
  let hasMetaData = false
  if (isObject(d.world) && isObject((d.world as Record<string, unknown>)._meta)) {
    hasMetaData = true
  }
  if (isObject(d.continents)) {
    for (const cid of CONTINENT_IDS) {
      const c = (d.continents as Record<string, unknown>)[cid]
      if (isObject(c) && isObject((c as Record<string, unknown>)._meta) && Object.keys((c as Record<string, unknown>)._meta as object).length > 0) {
        hasMetaData = true
        break
      }
    }
  }

  const worldFieldsTotal = countWorldTotalFields(d)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      worldFieldsFilled,
      worldFieldsTotal,
      continentsWithData,
      landingWithData,
      hasMetaData,
      version
    }
  }
}

// ─── Checksum 工具 ───────────────────────────────────────

export function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

export function verifyChecksum(data: Record<string, unknown>): boolean {
  if (!('checksum' in data) || typeof data.checksum !== 'string') return true // 无 checksum 时不阻止
  const { checksum, ...rest } = data
  return generateChecksum(rest) === checksum
}
