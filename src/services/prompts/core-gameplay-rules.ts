/**
 * 核心玩法规则（静态注入常量）
 *
 * 由模板通过 `staticInjections: [STATIC_INJECTION_CORE_GAMEPLAY]` 声明依赖后，
 * 在 buildFullPrompt 中会以高优先级块注入到 user prompt 的上下文部分最前面。
 *
 * 保留脑图原始措辞，作为剧情生成时的游戏机制约束。
 */

import {
  STATIC_INJECTION_STORY_TIERS,
  STORY_TIER_RULES_TEXT,
  STORY_TIER_LABEL
} from './story-tier-rules'

export const STATIC_INJECTION_CORE_GAMEPLAY = 'core-gameplay-rules'

export const CORE_GAMEPLAY_RULES_TEXT = `## 核心玩法规则（剧情必须围绕这些机制展开）

### 一、城防关卡（战斗核心）
- 防守成功进去下一个关
- 防守失败从区域第1关重新开始
- 多波次怪物进攻城堡
- 主要承担怪物集团化进攻城堡剧情（防守割草是游戏的战斗核心），每个关卡最后的 boss 有简单剧情

### 二、探索玩法
- 挂机玩法：练功场、金币场、木材场、魂晶场
- 副本：依次通关几关，杀完 boss 给大奖；杀完一个关卡，前进探索下一个；每一个区域 2 个副本
- 每个区域都有一片单独区域承担剧情，副本则可能会偏怪物首领的进阶方向，探索巢穴发现更多内容。挂机玩法不需要剧情

### 三、灾厄玩法
- 单人 boss，越挑战越难
- 独立的跨界剧情线（全都是独立的对玩家和团队的考验，没有城堡，纯 3 英雄对抗灾厄，怪物风格和当前大陆不一致，有自己的独立风格）
- 会隐含各种世界的真相，可能是深渊或者神殿的一些首领的提前出现，至少每个是清醒的角色
- 预计 MVP 30 个左右的灾厄。击败一个之后，等一段时间自动出现下一个

### 四、区域进化条件
- 完成区域防守 + 探索区域所有副本 → 可以实现该区域的进化`

/**
 * 根据 staticInjections 键获取对应的静态内容块
 * 返回 null 表示未识别的键
 */
export function getStaticInjectionContent(key: string): string | null {
  if (key === STATIC_INJECTION_CORE_GAMEPLAY) {
    return CORE_GAMEPLAY_RULES_TEXT
  }
  if (key === STATIC_INJECTION_STORY_TIERS) {
    return STORY_TIER_RULES_TEXT
  }
  return null
}

/**
 * 根据 staticInjections 键获取展示标签
 */
export function getStaticInjectionLabel(key: string): string {
  if (key === STATIC_INJECTION_CORE_GAMEPLAY) {
    return '核心玩法规则（游戏机制约束）'
  }
  if (key === STATIC_INJECTION_STORY_TIERS) {
    return STORY_TIER_LABEL
  }
  return key
}
