/**
 * 剧情体裁分层规则（静态注入常量）
 *
 * 甲方对"剧情"的体裁职责分层：
 * - 功能开启剧情：轻量对话，负责解锁新功能时的引导
 * - 主线任务剧情：承担玩家长期剧情记忆，驱动下一阶段区域目标
 *
 * 由模板通过 `staticInjections: [STATIC_INJECTION_STORY_TIERS]` 声明依赖后注入。
 * 保留脑图原始措辞。
 */

export const STATIC_INJECTION_STORY_TIERS = 'story-tier-rules'

export const STORY_TIER_LABEL = '剧情体裁分层（叙事约束）'

export const STORY_TIER_RULES_TEXT = `## 剧情体裁分层（生成剧情时必须按此分层产出）

### 一、功能开启剧情
- 几句对话介绍功能性玩法
- 定位：轻量、工具性，解锁新功能（如挂机场、副本、灾厄开启）时使用

### 二、主线任务剧情
- 主要承担玩家对于剧情的记忆
- 下一阶段的主要目标是完成守护或者探索该区域，或者击败某个灾厄得到线索
- 定位：核心叙事载体，驱动玩家长期目标感`
