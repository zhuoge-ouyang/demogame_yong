import type { PromptTemplate } from '@/types/ai'
import { CONTINENTS } from '@/constants/continents'
import { ASPECT_LABELS } from '@/types/continent'
import type { ContinentId, ContinentAspects } from '@/types/continent'
import { PHASE2_CONTINENT_REFERENCES } from './references/phase2-continent-refs'

const FIELD_LENGTH_HINTS: Record<keyof ContinentAspects, string> = {
  mainPlot: '520-720字（约600字）',
  coreConflict: '200-300字',
  playerGoal: '200-320字',
  storyGameplayConcept: '320-500字',
  experiencePositioning: '200-320字',
  inGameExpression: '320-500字',
  themeExpression: '160-260字',
  playerProgressionChanges: '280-420字'
}

function getPhase2OutputFormat(aspectKey: keyof ContinentAspects): string {
  if (aspectKey === 'storyGameplayConcept') {
    return `请只输出「${ASPECT_LABELS[aspectKey]}」正文，建议${FIELD_LENGTH_HINTS[aspectKey]}。
内容必须直接服务现有塔防挂机核心，写清地图规则、玩家在战前或波次间的低频决策、敌方反制，以及区域1-3、区域4-6、区域7-9的递进。
只设计一条核心玩法规则和必要变体；优先复用摆塔、塔位强化、敌人路线、波次和地图目标，不写具体数值、奖励、商业化包装，也不要新增独立养成系统。`
  }

  return `请只输出「${ASPECT_LABELS[aspectKey]}」正文，建议${FIELD_LENGTH_HINTS[aspectKey]}。
内容要简单、有意义、符合既有世界观；必须让甲方快速看懂核心剧情、核心冲突、玩家在故事中的目标和剧情推进变化。
严格保持剧情与玩法/数值设计分离，不要写数值、系统、奖励、具体关卡规则或商业化包装；不要使用宏大CG、大段CG或3D时间线。`
}

function getPhase2Reference(continentId: ContinentId, aspectKey: keyof ContinentAspects): string {
  return PHASE2_CONTINENT_REFERENCES[`${continentId}_${aspectKey}` as keyof typeof PHASE2_CONTINENT_REFERENCES] || ''
}

const PHASE1_CHAPTER_ALIGNMENT: Partial<Record<ContinentId, string>> = {
  jin: '硬性对齐：金耀大陆必须参考奥里克·铸金的英雄背景，以及阶段一第一章「翠森大陆·根腐之醒」中奥里克因金耀骑士团分裂与黑金矿脉污染离乡求援、在翠森边境护住艾蕾尼娅、与刚苏醒的方舟堡相遇、参与三日防御战，并以铸金信物正式加入阵营的剧情。金耀大陆页签是奥里克后续完整回乡收复王城篇，必须写清守城处决派、救赎派新誓骑士与黑金腐化军团围绕王城命运的斗争。',
  mu: '硬性对齐：翠森大陆必须对应阶段一第一章「翠森大陆·根腐之醒」，重点是方舟堡苏醒、根语者唤醒、艾蕾尼娅引导、奥里克相遇、塞琳娜预告霜寒危机、伊格纳修斯不死鸟失控危机，并以方舟堡获得迁移能力转入霜寒大陆。',
  bing: '硬性对齐：霜寒大陆必须对应阶段一第二章「霜寒大陆·融冰救境」，重点是方舟堡迁入霜寒，帮助塞琳娜解决永冻层融化、冰湖倒灌、寒潮封城等巨大环境问题，并让塞琳娜从独自压制转为接受协作修复。',
  huo: '硬性对齐：炎狱大陆必须对应阶段一第三章「炎狱大陆·不死鸟失控」，重点是方舟堡帮助伊格纳修斯控制不死鸟兽形态，让不死鸟火从失控灾厄转为可被托付的净化力量，并形成金、冰、火三英雄战团。'
}

const PHASE2_MAIN_PLOT_ALIGNMENT: Partial<Record<ContinentId, string>> = {
  bing: `【用户提示】
硬性对齐：霜寒大陆必须参考塞琳娜·霜誓的英雄背景，以及阶段一第二章「霜寒大陆·融冰救境」
以下为重要情节：
1. 方舟堡沿冰晶信标迁入霜寒大陆，塞琳娜·霜誓的领地已经失控：大量村镇又被反常寒潮封住，寒潮引发深渊魔兽的入侵。她承认自己离开后冰脉更快恶化。

2. 赛琳娜引导方舟堡进入冰下遗迹，以调和之力解除遗迹的冰封。结果方舟堡的调和之力意外和冰之魂令上残留的魂族力量产生共鸣，魂族被压迫的历史和求救的信号第一次展示在众人面前。

3. 众人前往最后一个冰下遗迹时，意外遇上霜脊巨兽。众人合力击退巨兽，成功修复冰之魂令。寒潮退去，村镇开始复苏。

请为霜寒大陆（冰元素大陆）设计主线剧情框架。`,
  feng: `【用户提示】
硬性设定：风语大陆本来就是稳定悬浮于云海之上的完整大陆，不存在持续下坠或等待玩家阻止坠落的问题。当前危机是风之封魂令被污染后，大陆外围生成无数龙卷风，形成封锁内外交通的风墙。
剧情前期，英雄团必须骑乘风语大陆本地飞行兽，依靠特殊风铃信标辨认唯一安全航路；方向或操控错误会被龙卷风送回上一处安全信标。泽菲尔·逐风以受损风翼和辨风经验担任领航者。剧情后期修复封魂令与信标网络后，异常龙卷风墙消散为正常风道，玩家可以自由飞行出入大陆。
风墙、信标与飞行进入必须进入三幕主线，且与堕落风咏者篡改航向、封锁大陆真相的行动直接相关。不要写成浮岛不断坠落，也不要把飞行兽扩展成独立宠物养成系统。`,
  lei: `【用户提示】
硬性设定：雷霆大陆的核心不是抽象蓄电，而是覆盖城镇、祭台与防御塔位的古代雷纹回路。雷之封魂令受污染后，公共回路断裂并被反向操控，雷霆从共同分担的守护力量变成把过载与牺牲压给少数人的惩罚工具。
托尔加·雷铸曾在回路崩溃时被迫充当“活体保险丝”，但最终成长不是继续独自承受雷电，而是帮助方舟堡重连回路，让防御塔、城镇节点与族人共同分担压力。堕落雷祭司会派出断路者破坏或污染回路节点，并企图让逆流冲击方舟堡根核；终幕要把伪造的审判频率反送回审判柱，修复雷之封魂令并终止以死亡证明荣耀的成年礼。
主线必须让雷纹回路服务于塔防场景、敌人路线和防御塔协同，不要只写蓄电、放电或托尔加个人抗雷。`
}

function getPhase2Alignment(continentId: ContinentId, aspectKey: keyof ContinentAspects): string | undefined {
  if (aspectKey === 'mainPlot' && PHASE2_MAIN_PLOT_ALIGNMENT[continentId]) {
    return PHASE2_MAIN_PLOT_ALIGNMENT[continentId]
  }
  return PHASE1_CHAPTER_ALIGNMENT[continentId]
}

function makeContinentPrompt(aspectKey: keyof ContinentAspects): Record<string, PromptTemplate> {
  const result: Record<string, PromptTemplate> = {}

  for (const c of CONTINENTS) {
    const templateId = `phase2-${c.id}-${aspectKey}`

    const aspectInstructions: Record<keyof ContinentAspects, string> = {
      mainPlot: `请为${c.name}（${c.element}元素大陆）设计主线剧情框架。

包含：
1. 一句话说明大陆危机与氛围
2. 以三幕式故事结构来撰写${c.name}的主线剧情，${c.name}共9个区域，每3个区域一幕剧情
3、封魂令恢复正常，大陆危机解除
4. 与三界、世界树或深渊大背景的简短关联`,

      coreConflict: `请为${c.name}（${c.element}元素大陆）设计核心冲突。

包含：
1. 大陆内部的主要势力/阵营对立
2. 冲突根源，只写影响当前剧情的部分
3. ${c.element}元素如何影响和塑造这种冲突
4. 玩家介入冲突的方式
5. 冲突与封魂令碎片的关系`,

      playerGoal: `请为${c.name}（${c.element}元素大陆）设计玩家的阶段目标。

包含：
1. 玩家在本大陆必须完成的3个剧情目标
2. 收集封魂令碎片的过程
3. 章节结束时的剧情成果

不要写功能解锁、数值成长、玩法循环或奖励。`,

      storyGameplayConcept: `请结合${c.name}已经确定的主线剧情、核心冲突和玩家目标，设计一项可以落地到塔防挂机核心循环中的玩法构想。

包含：
1. 大陆环境规则如何作用于防御塔、敌人路线、战斗波次或地图目标
2. 玩家在战前或波次之间进行什么低频选择
3. 敌方势力如何利用同一规则反制玩家
4. 区域1-3负责教学、区域4-6制造变化、区域7-9让玩家反用规则完成剧情高潮
5. 危机解除后，地图状态如何体现大陆恢复

只设计一条核心规则和必要变体，复用已有摆塔、塔位强化、敌人路线、波次与挂机流程。风语大陆必须包含飞行兽循信标穿越风墙的章节入口，并让信标继续承担塔防地图目标；雷霆大陆必须围绕连接塔位的雷纹回路、断路者破坏节点与防御塔联动展开。不要新增独立宠物养成、资源养成或与塔防割裂的小游戏。`,

      experiencePositioning: `请为${c.name}（${c.element}元素大陆）设计体验定位。

体验定位指的是玩家在这个大陆中应该获得的核心情感体验。
可以包含但不限于：感动、震撼、背叛、反转、神秘、恐惧、史诗等。

请说明：
1. 这个大陆的核心情感体验是什么
2. 如何通过简短剧情节奏实现这种体验
3. 关键情感高潮点
4. 与其他大陆的体验差异化`,

      inGameExpression: `请为${c.name}（${c.element}元素大陆）设计剧情呈现方式。

即剧情和世界观如何被玩家看见、听见、理解：
1. 环境叙事（遗迹、地貌、符号、物件）
2. NPC证词、文献、回忆或事件余波
3. 关键场景如何揭示真相
4. 章节结束时世界状态如何体现剧情变化
5. 结合塔防挂机游戏的轻量承载方式，例如节点背景、短对白、波次/敌人命名、地图状态变化、简短事件文本

只写叙事呈现，不设计玩法机制、关卡规则、奖励或数值；不要使用宏大CG、大段CG或3D时间线。`,

      themeExpression: `请为${c.name}（${c.element}元素大陆）设计主题表达。

主题指的是这个大陆想要传达的深层思想/寓意：
1. 大陆的核心主题是什么（如"荣耀与代价"、"自然与文明"等）
2. 主题如何通过角色、事件、环境简短体现
3. ${c.element}元素的象征意义
4. 与游戏整体主题的呼应`,

      playerProgressionChanges: `请为${c.name}（${c.element}元素大陆）设计玩家推进变化。

描述玩家在这个大陆推进过程中，剧情和世界状态会发生的变化：
1. 玩家认知发生了什么变化
2. 大陆危机从什么状态转为什么状态
3. 关键角色与玩家/方舟堡的关系如何变化
4. 该大陆为后续三界主线留下什么线索
5. 必须按区域1-3、区域4-6、区域7-9说明三段剧情推进节奏

不要写功能解锁、新玩法、数值成长或系统奖励。`
    }

    result[templateId] = {
      templateId,
      moduleLabel: `${c.name} · ${ASPECT_LABELS[aspectKey]}`,
      contextDependencies: ['phase1-summary', `phase2-${c.id}-prior`],
      referenceDocuments: [
        { label: `${c.name} · ${ASPECT_LABELS[aspectKey]}（同步参考稿）`, content: getPhase2Reference(c.id, aspectKey) }
      ],
      userPromptTemplate: [
        getPhase2Alignment(c.id, aspectKey),
        aspectKey === 'mainPlot' && PHASE2_MAIN_PLOT_ALIGNMENT[c.id]
          ? undefined
          : aspectInstructions[aspectKey]
      ].filter(Boolean).join('\n\n'),
      outputFormatInstructions: getPhase2OutputFormat(aspectKey)
    }
  }

  return result
}

// 生成所有大陆×维度的prompt模板
export function getPhase2Prompt(continentId: ContinentId, aspectKey: keyof ContinentAspects): PromptTemplate {
  const templates = makeContinentPrompt(aspectKey)
  return templates[`phase2-${continentId}-${aspectKey}`]
}
