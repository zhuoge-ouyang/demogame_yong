/**
 * AI 生成内容解析工具
 * 将AI的结构化文本按【标记】分段，映射到表单字段
 */

/**
 * 按【section】标记拆分AI输出为 key→value 字典
 * 例如输入: "【概述】xxx\n【详情】yyy"
 * 输出: { '概述': 'xxx', '详情': 'yyy' }
 */
export function parseSections(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regex = /【([^】]+)】/g
  const matches = [...content.matchAll(regex)]

  if (matches.length === 0) return result

  for (let i = 0; i < matches.length; i++) {
    const key = matches[i][1].trim()
    const startIdx = matches[i].index! + matches[i][0].length
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : content.length
    const value = content.slice(startIdx, endIdx).trim()
    if (value) result[key] = value
  }

  return result
}

/**
 * 按【block-N】标记拆分为数组，每个 block 内部按 "标签：值" 解析
 * 用于英雄列表、Boss列表、关卡节点列表等
 */
export function parseBlockList(
  content: string,
  fieldLabels: Record<string, string[]>
): Record<string, string>[] {
  const blocks: Record<string, string>[] = []
  const regex = /【([^】]+)】/g
  const matches = [...content.matchAll(regex)]

  if (matches.length === 0) return blocks

  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index! + matches[i][0].length
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : content.length
    const blockText = content.slice(startIdx, endIdx).trim()

    if (!blockText) continue

    const parsed: Record<string, string> = {}
    for (const [fieldKey, aliases] of Object.entries(fieldLabels)) {
      for (const alias of aliases) {
        // 匹配 "标签：值" 或 "**标签**：值" 或 "标签: 值"
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const labelRegex = new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?[：:]\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\*\\*)?(?:${
            Object.values(fieldLabels).flat().map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
          })(?:\\*\\*)?[：:]|$)`
        )
        const match = blockText.match(labelRegex)
        if (match?.[1]?.trim()) {
          parsed[fieldKey] = match[1].trim()
          break
        }
      }
    }

    // 如果没解析出任何字段，把整个 blockText 当作第一个字段的值
    if (Object.keys(parsed).length === 0) {
      const firstKey = Object.keys(fieldLabels)[0]
      if (firstKey) parsed[firstKey] = blockText
    }

    blocks.push(parsed)
  }

  return blocks
}

/**
 * 简单的按行 label: value 解析（用于单个 block 内的字段提取）
 */
export function parseKeyValueBlock(
  text: string,
  fieldLabels: Record<string, string[]>
): Record<string, string> {
  const result: Record<string, string> = {}
  const allLabels = Object.values(fieldLabels).flat()

  for (const [fieldKey, aliases] of Object.entries(fieldLabels)) {
    for (const alias of aliases) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const otherLabels = allLabels.filter(l => l !== alias)
        .map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

      let lookahead = '$'
      if (otherLabels.length > 0) {
        lookahead = `(?=\\n\\s*(?:\\d+\\.\\s*)?(?:\\*\\*)?(?:${otherLabels.join('|')})(?:\\*\\*)?[：:])|$`
      }

      const regex = new RegExp(
        `(?:^|\\n)\\s*(?:\\d+\\.\\s*)?(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?[：:]\\s*([\\s\\S]*?)(?:${lookahead})`,
        'm'
      )
      const match = text.match(regex)
      if (match?.[1]?.trim()) {
        result[fieldKey] = match[1].trim()
        break
      }
    }
  }

  return result
}

/**
 * 将 sections 字典按映射表填充到目标对象
 * 只填充有值的字段，不覆盖已有内容
 */
export function applySections<T extends Record<string, any>>(
  target: T,
  sections: Record<string, string>,
  mapping: Record<string, keyof T>
): boolean {
  let applied = false
  for (const [sectionKey, fieldKey] of Object.entries(mapping)) {
    if (sections[sectionKey] && typeof target[fieldKey] === 'string') {
      ;(target as any)[fieldKey] = sections[sectionKey]
      applied = true
    }
  }
  return applied
}

/**
 * 在 sections 字典中按多个别名查找第一个有值的 section
 */
export function findSection(sections: Record<string, string>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    if (sections[alias]?.trim()) return sections[alias]
  }
  return undefined
}

// ==================== 模块专用映射常量 ====================

/**
 * 世界树系统 section 别名映射
 * key = WorldTreeSystemData 字段名，value = prompt 输出中可能的 section 标题别名
 */
export const WORLD_TREE_SECTION_ALIASES: Record<string, string[]> = {
  growthMechanism: ['成长机制', '成长阶段与机制', '世界树成长机制'],
  resourceContribution: ['资源贡献', '资源贡献方式', '玩家资源贡献'],
  unlockedFeatures: ['解锁功能', '成长解锁功能', '功能解锁'],
  fourthForce: ['第四势力', '第四势力形成', '第四域'],
  runeConnection: ['符文关联', '符文与世界树', '符文关联概述']
}

/**
 * 城堡女神 section 别名映射
 */
export const GODDESS_SECTION_ALIASES: Record<string, string[]> = {
  name: ['女神名字'],
  appearance: ['女神外观'],
  personality: ['女神性格']
}

export const CASTLE_SECTION_ALIASES: Record<string, string[]> = {
  description: ['城堡描述'],
  significance: ['城堡意义']
}

/**
 * 英雄系统 key-value 字段标签（含 joinStage 和 storyRole）
 */
export const HERO_FIELD_LABELS: Record<string, string[]> = {
  name: ['名字', '名称', '英雄名'],
  visual: ['视觉描述', '视觉', '外观', '视觉风格'],
  personality: ['性格特征', '性格', '核心性格'],
  backstory: ['背景故事', '背景', '简要背景'],
  role: ['角色设定', '故事角色', '角色定位', '角色', '在故事中的角色'],
  joinCondition: ['加入条件', '加入'],
  joinStage: ['加入阶段', '加入时机'],
  storyRole: ['故事角色定位', '故事定位', '整体故事角色']
}

/**
 * 使用别名映射将 sections 字典填充到目标对象
 */
export function applySectionsWithAliases<T extends Record<string, any>>(
  target: T,
  sections: Record<string, string>,
  aliasMapping: Record<string, string[]>
): boolean {
  let applied = false
  for (const [fieldKey, aliases] of Object.entries(aliasMapping)) {
    const value = findSection(sections, aliases)
    if (value && fieldKey in target && typeof target[fieldKey] === 'string') {
      ;(target as any)[fieldKey] = value
      applied = true
    }
  }
  return applied
}
