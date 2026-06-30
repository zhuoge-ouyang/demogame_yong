import type { PromptTemplate } from '@/types/ai'
import type { LandingContinentId } from '@/types/landing'
import { CONTINENT_MAP } from '@/constants/continents'

type Phase3Module = 'entry-prompt' | 'completion-feedback' | 'boss-design' | 'level-nodes'

export function getPhase3Prompt(continentId: LandingContinentId, moduleKey: Phase3Module): PromptTemplate {
  const meta = CONTINENT_MAP[continentId]

  const templates: Record<Phase3Module, PromptTemplate> = {
    'entry-prompt': {
      templateId: `phase3-${continentId}-entry`,
      moduleLabel: `${meta.name} · 进入提示`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计玩家进入该大陆时的提示内容。

包含三个部分：
1. **进入叙事**：玩家第一次踏入该大陆时的描述性文字，营造氛围（100-200字）
2. **NPC对话**：女神或当地NPC在玩家进入时的引导对话（3-5句）
3. **氛围描述**：该大陆的整体环境氛围、视觉特征、声音特征

请确保内容与该大陆的${meta.element}元素主题一致，且能激发玩家的探索欲望。`,
      outputFormatInstructions: `请严格按以下格式输出，每段内容用【标记】开头：

【进入叙事】
（玩家第一次踏入该大陆时的描述性文字）

【NPC对话】
（女神或当地NPC的引导对话）

【氛围描述】
（整体环境氛围、视觉特征、声音特征）`
    },

    'completion-feedback': {
      templateId: `phase3-${continentId}-completion`,
      moduleLabel: `${meta.name} · 通关反馈`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`, `phase3-${continentId}-entry`],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计通关后的反馈内容。

包含三个部分：
1. **通关叙事**：玩家完成该大陆所有挑战、获得封魂令后的剧情文字（150-250字），应有成就感和仪式感
2. **奖励故事**：获得封魂令的具体场景描述，封魂令的外观和特征
3. **过渡文本**：引导玩家前往下一大陆的叙事过渡（提示下一大陆的存在和特征）`,
      outputFormatInstructions: `请严格按以下格式输出，每段内容用【标记】开头：

【通关叙事】
（完成挑战后的剧情文字）

【奖励故事】
（获得封魂令的具体场景描述）

【过渡文本】
（引导前往下一大陆的叙事过渡）`
    },

    'boss-design': {
      templateId: `phase3-${continentId}-boss`,
      moduleLabel: `${meta.name} · Boss设计`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计Boss角色。

该大陆有9个区域，请至少设计3-5个关键Boss，包含区域Boss和最终Boss。

对于每个Boss，请设计：
1. **名字**：符合西幻风格和${meta.element}元素主题
2. **身份背景**：是什么存在，来自哪里，与大陆的关系
3. **动机**：为什么要阻拦玩家/守护封魂令
4. **标志性台词**：一句能体现其性格和动机的经典台词
5. **开场设计**：Boss出现时的场景描述（视觉表现）
6. **与核心冲突的关系**：这个Boss如何体现/推动大陆的核心冲突`,
      outputFormatInstructions: `请严格按以下格式输出，每个Boss用【标记】开头，属性每行一个：

【Boss1】
名字：（Boss名称）
身份背景：（是什么存在，来自哪里）
动机：（为什么阻拦玩家）
标志性台词：（一句经典台词）
开场设计：（出现时的场景描述）
核心冲突关系：（如何推动大陆的核心冲突）

【Boss2】
（同上格式）

【Boss3】
（同上格式）

以此类推...`
    },

    'level-nodes': {
      templateId: `phase3-${continentId}-levels`,
      moduleLabel: `${meta.name} · 关卡节点`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`, `phase3-${continentId}-boss`],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计9个区域的关卡节点。

每个区域是玩家推进的一个阶段，从边缘到核心逐步深入。

对于每个区域节点，请设计：
1. **区域名称**：体现该区域的特色和${meta.element}元素
2. **故事节拍**：这个区域的核心剧情事件/发现
3. **关键遭遇**：主要的战斗或探索事件
4. **叙事奖励**：通过该区域后获得的剧情信息或能力

请确保9个区域有明确的难度和剧情递进关系。`,
      outputFormatInstructions: `请严格按以下格式输出，每个区域用【标记】开头，属性每行一个：

【区域1】
名称：（区域名称）
故事节拍：（核心剧情事件）
关键遭遇：（主要战斗或探索事件）
叙事奖励：（通过后获得的剧情信息）

【区域2】
（同上格式）

以此类推到【区域9】`
    }
  }

  return templates[moduleKey]
}
