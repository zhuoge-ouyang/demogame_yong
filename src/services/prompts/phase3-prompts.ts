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
  const fireFinalActDirection = continentId === 'huo'
    ? `\n\n炎狱大陆第三幕必须采用特殊叙事口吻：区域7写大战前夜的压迫、集结与决绝；区域8用现在时写多线同时爆发的大陆大战；区域9写成神话悲剧，重点是在毁灭之火中唤回伊格纳修斯的名字与人格，而不是把他当作普通敌人击败。`
    : ''

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

只写玩家实际看到的系统短句。整体语气应像黑暗西方魔幻史诗中的无名见证者：克制、庄严、带有预兆感，不使用“任务完成”“奖励获得”“解锁区域”等界面语言。不要写长段叙事、NPC来回对话、玩法说明、战斗机制、数值、奖励或掉落。第三幕结尾必须体现“局部危机稳定、留下永久代价”，并给出前往下一大陆的叙事钩子。${fireFinalActDirection}`,
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
4. **一句话台词**：1句话，20-40个汉字，直接体现立场和动机；若不是人形智慧生物，可写灵魂回声、誓约残响或被译出的意志

Boss可以是智慧反派、古代守护者、异化巨兽或拥有意志的元素灾难，但必须有清晰的叙事主体性。不要设计技能、阶段机制、战斗数值、敌人配置、掉落或玩法。三个Boss必须形成逐幕升级的叙事因果链：第一幕暴露危机，第二幕揭开错误选择背后的真相，第三幕迫使主角与大陆共同承担代价。最终冲突结束后仍须留下不可逆后果。${fireFinalActDirection}`,
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
3. **区域故事**：120-180个汉字的可阅读正文，建议控制在130-160字；必须自然包含为何来到这里、发生的关键事件、面对的区域对手或正式Boss、方舟堡与玩家改变了什么，以及通往下一区域的因果钩子。输出前逐篇自检，任何超过180字或不足120字的正文都必须先重写再交付
4. **进入前提示**：玩家实际看到的1句话，20-40个汉字；采用黑暗西方魔幻的预兆或旁白口吻，不写功能提示
5. **结束后反馈**：玩家实际看到的1句话，20-40个汉字；写世界状态、关系或代价发生了什么变化，不写“任务完成”“奖励获得”
6. **叙事线索**：完成区域后获得的真相、证词、关系变化或下一步线索
7. **区域对手**：区域1、2、4、5、7、8各设计1名对手，写名字、身份、动机和20-40个汉字的一句话台词；对手可为智慧反派、怪物、古代守护者或拥有意志的元素灾难。非人对手的“台词”可写灵魂回声、誓约残响或被译出的意志

区域3、6、9只承接已给定的正式Boss，不重复创造区域对手。文案工作与玩法设计分离。不要写战斗机制、怪物配置、功能点、数值、技能、掉落或操作说明。区域故事以叙述为主，不写NPC来回对话，每篇最多保留一句直接引语。保留阶段一和阶段二已经确立的正史、英雄关系与最终走向；允许调整局部事件顺序以强化因果。九个区域必须形成连续因果链，不能是九个互不相关的灾难景点。只输出规定的九个【区域】区块，不添加思考过程、英文前言、分幕标题、分隔线或总结；必须完整写到【区域9】。${fireFinalActDirection}`,
      outputFormatInstructions: `请严格按以下格式输出，每个区域用【标记】开头，属性每行一个：

【区域1】
名称：（区域名称）
叙事任务：（内部设计目标）
区域故事：（120-180个汉字的正文）
进入前提示：（1句话，20-40个汉字）
结束后反馈：（1句话，20-40个汉字）
叙事线索：（通过后获得的剧情信息）
区域对手名字：（名称）
区域对手身份：（身份与阵营）
区域对手动机：（真实诉求）
区域对手台词：（1句话，20-40个汉字；也可为回声、残响或意志译文）

【区域2】
（同上格式）

【区域3】
名称：
叙事任务：
区域故事：（承接Boss1，120-180个汉字）
进入前提示：
结束后反馈：
叙事线索：

以此类推到【区域9】。区域4、5、7、8包含区域对手四项；区域6、9与区域3相同，只承接正式Boss。`
    }
  }

  return templates[moduleKey]
}
