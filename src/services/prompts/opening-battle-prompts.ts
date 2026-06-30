import type { PromptTemplate } from '@/types/ai'
import { OPENING_BATTLE_REFERENCES } from './references/opening-battle-refs'

/**
 * 开场大战版本配置
 * 当前只保留一个主版本：众神联合凡族打败深渊魂族的封渊之役
 */
export interface OpeningBattleVersion {
  id: string
  label: string
  subtitle: string
  description: string
  fieldKey: string  // 映射到 worldStore.state.openingBattle 的字段名
  pptFile: string
}

/** 开场大战的上下文依赖 */
const CONTEXT_DEPS = [
  'realm-overview',
  'realm-upper',
  'realm-mortal',
  'realm-abyss',
  'main-storyline',
  'hero-system',
  'world-tree-system',
  'player-identity'
] as const

/** Prompt 模板 */
const TEMPLATES: Record<string, PromptTemplate> = {
  'opening-battle-seal-abyss': {
    templateId: 'opening-battle-seal-abyss',
    moduleLabel: '开场大战 · 封渊之役',
    contextDependencies: [...CONTEXT_DEPS],
    referenceDocuments: [
      { label: '开场大战·封渊之役（同步参考稿）', content: OPENING_BATTLE_REFERENCES.sealAbyss }
    ],
    userPromptTemplate: `请创作一段开场大战剧情——「封渊之役」。

场景设定：上古纪元后期，魂域尚未划分三界。第一场魂域大战之后，九封魂令已存在，但根系回流与魂能归属引发新的战争。深渊魂族沿世界树根系夺取魂令锚点，众神联合凡族军团发动「魂域第二场大战」，最终打败深渊魂族，将他们封印到深渊/根域，并促成三界划分。

【创作要求】
1. 主要剧情必须围绕：众神联合凡族打败深渊魂族
2. 说明这是魂域第二场大战，不是游戏后期终局战，也不是世界树觉醒战
3. 写清深渊魂族的行动、众神与凡族结盟、封渊决战、三界划分结果
4. 深渊魂族不是纯粹怪物，而是根域文明中的战争势力
5. 三界不是天然秩序，而是第二场大战后的伤痕结构
6. 只写剧情，不写玩法机制、数值、关卡、系统解锁或奖励
7. 全文最多1200字`,
    outputFormatInstructions: '请以神话史诗风格输出一版完整剧情，最多1200字。可分自然段，但不要拆成多个版本。'
  }
}

/**
 * 根据版本ID获取开场大战Prompt模板
 */
export function getOpeningBattlePrompt(versionId: string): PromptTemplate | null {
  return TEMPLATES[versionId] ?? null
}

export const OPENING_BATTLE_VERSIONS: OpeningBattleVersion[] = [
  {
    id: 'opening-battle-seal-abyss',
    label: '封渊之役',
    subtitle: '魂域第二场大战',
    description: '上古纪元后期，众神联合凡族军团打败深渊魂族，将其封入世界树根系深处，并在战后促成上界、凡界、深渊三界划分。',
    fieldKey: 'sealAbyss',
    pptFile: ''
  }
]
