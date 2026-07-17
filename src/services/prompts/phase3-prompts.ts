import type { PromptTemplate } from '@/types/ai'
import type { LandingContinentId } from '@/types/landing'
import { CONTINENT_MAP } from '@/constants/continents'
import { PHASE3_LANDING_REFERENCES } from './references/phase3-landing-refs'

export type Phase3Module = 'system-dialogue' | 'boss-design' | 'region-copy'
type Phase3ReferenceSection = 'systemDialogue' | 'bosses' | 'levelNodes'

function getPhase3Reference(continentId: LandingContinentId, section: Phase3ReferenceSection): string {
  return PHASE3_LANDING_REFERENCES[`${continentId}_${section}` as keyof typeof PHASE3_LANDING_REFERENCES] || ''
}

export function getPhase3Prompt(continentId: LandingContinentId, moduleKey: Phase3Module): PromptTemplate {
  const meta = CONTINENT_MAP[continentId]

  const templates: Record<Phase3Module, PromptTemplate> = {
    'system-dialogue': {
      templateId: `phase3-${continentId}-system-dialogue`,
      moduleLabel: `${meta.name} · 系统对白`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`],
      referenceDocuments: [
        { label: `${meta.name} · 系统对白（同步参考稿）`, content: getPhase3Reference(continentId, 'systemDialogue') }
      ],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计少量系统对白。

交付范围严格限定为：
1. **开场对白**：玩家首次进入大陆时显示，1句话，20-40个汉字
2. **第一幕节点**：完成第3区域后显示，1句话，20-40个汉字
3. **第二幕节点**：完成第6区域后显示，1句话，20-40个汉字
4. **第三幕节点**：完成第9区域后显示，1句话，20-40个汉字

只写玩家实际看到的系统短句。不要写长段叙事、NPC来回对话、玩法说明、战斗机制、数值、奖励或掉落。第三幕结尾必须体现“局部危机稳定、留下永久代价”，并给出前往下一大陆的叙事钩子。`,
      outputFormatInstructions: `请严格按以下格式输出，每段内容用【标记】开头：

【开场对白】
（1句话，20-40个汉字）

【第一幕节点】
（1句话，20-40个汉字）

【第二幕节点】
（1句话，20-40个汉字）

【第三幕节点】
（1句话，20-40个汉字）`
    },

    'boss-design': {
      templateId: `phase3-${continentId}-boss-design`,
      moduleLabel: `${meta.name} · Boss设计`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`],
      referenceDocuments: [
        { label: `${meta.name} · Boss设计（同步参考稿）`, content: getPhase3Reference(continentId, 'bosses') }
      ],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计3名关键Boss。

3名Boss固定出现在第3、第6、第9区域，分别承担第一幕、第二幕、第三幕的幕末冲突。

对于每个Boss，请设计：
1. **名字**：符合西幻风格和${meta.element}元素主题
2. **身份**：它是谁、属于哪一方、与大陆危机和对应英雄有什么关系
3. **动机**：它真正想守护、夺取或掩盖什么，避免只写“邪恶”
4. **一句话台词**：1句话，20-40个汉字，直接体现立场和动机

不要设计技能、阶段机制、战斗数值、敌人配置、掉落或玩法。三个Boss必须形成逐幕升级的叙事因果链，最终Boss战败后仍留下不可逆代价。`,
      outputFormatInstructions: `请严格按以下格式输出，每个Boss用【标记】开头，属性每行一个：

【Boss1·第3区域】
名字：（Boss名称）
身份：（身份、阵营及叙事关系）
动机：（真实诉求）
一句话台词：（20-40个汉字）

【Boss2·第6区域】
名字：
身份：
动机：
一句话台词：

【Boss3·第9区域】
名字：
身份：
动机：
一句话台词：`
    },

    'region-copy': {
      templateId: `phase3-${continentId}-region-copy`,
      moduleLabel: `${meta.name} · 九区域文案`,
      contextDependencies: ['phase1-summary', `phase2-${continentId}-all`, `phase3-${continentId}-boss-design`],
      referenceDocuments: [
        { label: `${meta.name} · Boss设计（同步参考稿）`, content: getPhase3Reference(continentId, 'bosses') },
        { label: `${meta.name} · 关卡节点（同步参考稿）`, content: getPhase3Reference(continentId, 'levelNodes') }
      ],
      userPromptTemplate: `请为${meta.name}（${meta.element}元素大陆）设计9个区域的叙事文案。

区域1-3为第一幕，区域4-6为第二幕，区域7-9为第三幕；从大陆边缘逐步深入核心。第3、第6、第9区域分别承接对应Boss。

对于每个区域节点，请设计：
1. **区域名称**：体现该区域的特色和${meta.element}元素
2. **叙事任务**：内部文案设计目标，写清玩家在此发现、确认或改变什么
3. **进入前提示**：玩家实际看到的1句话，20-40个汉字
4. **结束后反馈**：玩家实际看到的1句话，20-40个汉字
5. **叙事线索**：完成区域后获得的真相、证词、关系变化或下一步线索

文案工作与玩法设计分离。不要写战斗机制、怪物配置、功能点、数值、技能、掉落或操作说明。九个区域必须形成连续因果链，不能是九个互不相关的灾难景点。`,
      outputFormatInstructions: `请严格按以下格式输出，每个区域用【标记】开头，属性每行一个：

【区域1】
名称：（区域名称）
叙事任务：（内部设计目标）
进入前提示：（1句话，20-40个汉字）
结束后反馈：（1句话，20-40个汉字）
叙事线索：（通过后获得的剧情信息）

【区域2】
（同上格式）

以此类推到【区域9】`
    }
  }

  return templates[moduleKey]
}
