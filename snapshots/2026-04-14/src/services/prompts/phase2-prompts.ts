import type { PromptTemplate } from '@/types/ai'
import { CONTINENTS } from '@/constants/continents'
import { ASPECT_LABELS } from '@/types/continent'
import type { ContinentId, ContinentAspects } from '@/types/continent'

function makeContinentPrompt(aspectKey: keyof ContinentAspects): Record<string, PromptTemplate> {
  const result: Record<string, PromptTemplate> = {}

  for (const c of CONTINENTS) {
    const templateId = `phase2-${c.id}-${aspectKey}`

    const aspectInstructions: Record<keyof ContinentAspects, string> = {
      mainPlot: `请为${c.name}（${c.element}元素大陆）设计主线剧情框架。

包含：
1. 大陆的基本设定与氛围
2. 主线剧情的起承转合
3. 封魂令在此大陆的存在形式和获取方式
4. 与整体三界大背景的关联
5. 剧情高潮与结局`,

      coreConflict: `请为${c.name}（${c.element}元素大陆）设计核心冲突。

包含：
1. 大陆内部的主要势力/阵营对立
2. 冲突的根源和历史
3. ${c.element}元素如何影响和塑造这种冲突
4. 玩家介入冲突的方式
5. 冲突与封魂令的关系`,

      playerGoal: `请为${c.name}（${c.element}元素大陆）设计玩家的阶段目标。

包含：
1. 主要目标（收集封魂令的过程）
2. 支线目标（探索、社交、收集等）
3. 目标的递进关系
4. 完成目标时的成就感设计`,

      experiencePositioning: `请为${c.name}（${c.element}元素大陆）设计体验定位。

体验定位指的是玩家在这个大陆中应该获得的核心情感体验。
可以包含但不限于：感动、震撼、背叛、反转、神秘、恐惧、史诗等。

请说明：
1. 这个大陆的核心情感体验是什么
2. 如何通过剧情节奏来实现这种体验
3. 关键情感高潮点的设计
4. 与其他大陆的体验差异化`,

      inGameExpression: `请为${c.name}（${c.element}元素大陆）设计游戏内的表达方式。

即剧情和世界观如何在游戏中呈现给玩家：
1. 探索玩法中的叙事表达（地图元素、可调查物品、环境叙事）
2. 城防战斗中的叙事表达（Boss台词、战斗事件）
3. 灾厄事件的叙事表达
4. NPC互动与对话设计
5. 区域氛围的营造手段`,

      themeExpression: `请为${c.name}（${c.element}元素大陆）设计主题表达。

主题指的是这个大陆想要传达的深层思想/寓意：
1. 大陆的核心主题是什么（如"荣耀与代价"、"自然与文明"等）
2. 主题如何通过角色、事件、环境来体现
3. ${c.element}元素的象征意义
4. 与游戏整体主题的呼应`,

      playerProgressionChanges: `请为${c.name}（${c.element}元素大陆）设计玩家推进变化。

描述玩家在这个大陆推进过程中，世界会发生的可见变化：
1. 区域解锁的顺序和条件
2. 随着推进，地图/环境的视觉变化
3. NPC态度和行为的变化
4. 势力格局的变化
5. 解锁的新功能或新玩法`
    }

    result[templateId] = {
      templateId,
      moduleLabel: `${c.name} · ${ASPECT_LABELS[aspectKey]}`,
      contextDependencies: ['phase1-summary', `phase2-${c.id}-prior`],
      userPromptTemplate: aspectInstructions[aspectKey],
      outputFormatInstructions: '请用清晰的层级结构输出，关键设定加粗标注。'
    }
  }

  return result
}

// 生成所有大陆×维度的prompt模板
export function getPhase2Prompt(continentId: ContinentId, aspectKey: keyof ContinentAspects): PromptTemplate {
  const templates = makeContinentPrompt(aspectKey)
  return templates[`phase2-${continentId}-${aspectKey}`]
}
