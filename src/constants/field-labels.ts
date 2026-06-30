export const FIELD_LABELS: Record<string, Record<string, string>> = {
  realmStructure: {
    'summary': '三界结构-概述',
    'upper.past': '三界结构-上界-过去',
    'upper.present': '三界结构-上界-现状',
    'upper.future': '三界结构-上界-未来',
    'mortal.past': '三界结构-凡界-过去',
    'mortal.present': '三界结构-凡界-现状',
    'mortal.future': '三界结构-凡界-未来',
    'abyss.past': '三界结构-深渊-过去',
    'abyss.present': '三界结构-深渊-现状',
    'abyss.future': '三界结构-深渊-未来',
  },
  mainStoryline: {
    'overview': '主线剧情-概述',
  },
  playerIdentity: {
    'origin': '玩家身份-起源',
    'initialPerception': '玩家身份-初始认知',
    'revelationArc': '玩家身份-揭示弧线',
  },
  heroSystem: {},
  castleGoddess: {
    'castle.description': '城堡女神-城堡描述',
    'castle.significance': '城堡女神-城堡象征意义',
    'goddess.appearance': '城堡女神-女神外观',
    'goddess.personality': '城堡女神-女神性格',
  }
}

// 动态字段的标签生成（如英雄系统、剧情阶段）
export function getFieldLabel(moduleName: string, fieldPath: string): string {
  const moduleLabels = FIELD_LABELS[moduleName]
  if (moduleLabels && moduleLabels[fieldPath]) {
    return moduleLabels[fieldPath]
  }
  // 处理动态字段
  if (moduleName === 'mainStoryline' && fieldPath.startsWith('stages.')) {
    const match = fieldPath.match(/stages\.(\d+)\.(\w+)/)
    if (match) {
      const stageIndex = parseInt(match[1]) + 1
      const fieldName = match[2]
      const fieldMap: Record<string, string> = { goal: '目标', events: '事件', resolution: '结局' }
      return `主线剧情-阶段${stageIndex}-${fieldMap[fieldName] || fieldName}`
    }
  }
  if (moduleName === 'heroSystem') {
    const match = fieldPath.match(/(.+?)\.(\w+)$/)
    if (match) {
      const fieldMap: Record<string, string> = { role: '角色定位', joinStage: '加入阶段', storyRole: '角色设定', backstory: '背景故事' }
      return `英雄系统-${match[1]}-${fieldMap[match[2]] || match[2]}`
    }
  }
  return `${moduleName}.${fieldPath}`
}
