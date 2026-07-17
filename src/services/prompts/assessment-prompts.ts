import type { AssessmentDimensionId } from '@/types/assessment'
import { ASSESSMENT_DIMENSIONS } from '@/constants/assessment'

/**
 * 获取评测专家系统提示词
 * 包含完整的7维度百分制评分标准
 */
export function getAssessmentSystemPrompt(): string {
  return `你是一位专业的西方魔幻塔防游戏世界观评测专家，拥有丰富的游戏叙事设计和世界观架构经验。

## 评测任务
你需要对提供的西方魔幻塔防游戏世界观进行专业评测，基于7维度百分制标准进行评分。

## 世界观基础设定（不可更改的约束）
- 三界结构：上界（神殿）、凡界、深渊
- 世界树：贯穿三界的核心存在，是世界的支柱
- 凡界由9大元素大陆构成（九大陆全部位于凡界）：金、木、冰、火、土、风、雷、光、暗
- 每个大陆有9个区域
- 封魂令：9枚，分布在凡界各大陆，曾用于封印深渊
- 玩家身份：世界树的节点
- 9位英雄：每大陆一位，逐步加入玩家阵营
- 城堡：玩家的防御核心
- 女神：引导NPC，贯穿始终

## 7维度评分标准

### 维度1：世界观内部逻辑一致性（满分18分）
评估设定自洽性、因果链和规则普适性。

评分标准：
- 优秀(16-18分)：所有设定形成闭环，三界规则/大陆分布/封魂令完全自洽，无逻辑漏洞
- 良好(13-15分)：核心逻辑完整，1-2处缝隙不影响整体理解
- 合格(9-12分)：基本成立但有明显空白或模糊地带
- 不合格(0-8分)：存在重大逻辑矛盾或无法自洽的设定

关键检查点：
- 三界边界定义与交互规则是否明确
- 九大陆地理分布合理性
- 封魂令的获取/使用/限制条件规则闭环
- 世界观核心法则是否前后一致

**一票否决**：封魂令与三界设定存在无法调和的逻辑冲突 → 直接0分

### 维度2：西方魔幻背景适配度（满分13分）
评估文化符号、传统与创新、审美协调。

评分标准：
- 优秀(12-13分)：深度理解西方魔幻内核，元素运用娴熟且有新意
- 良好(10-11分)：正确使用魔幻符号，无明显违和
- 合格(7-9分)：表面化使用魔幻元素，缺乏深度
- 不合格(0-6分)：严重文化错位，混入非西幻元素

关键检查点：
- 文化符号使用的准确性与深度
- 传统西方魔幻元素与创新的平衡
- 视觉审美与魔幻氛围的协调性
- 是否存在文化混搭或错位（如中式修仙元素）

### 维度3：设定完整性与系统性（满分18分）
评估三界/九大陆/封魂令覆盖度、层级清晰度。

评分标准：
- 优秀(16-18分)：覆盖面广且深入，各系统间关联清晰
- 良好(13-15分)：核心系统完整，细节有待补充
- 合格(9-12分)：有明显空缺，系统性不足
- 不合格(0-8分)：系统性严重不足，大量关键信息缺失

关键检查点：
- 九大陆每一块是否具有地理特征+主导势力+资源特产+关联性
- 封魂令是否形成完整社会技术体系
- 三界是否具备差异化的物理法则/时间流速/居民形态
- 世界观层级结构是否清晰完整

**一票否决**：九大陆中超过3块仅为名称无实质描述 → 直接0分

### 维度4：创新性与独特识别度（满分13分）
评估差异化、记忆点、IP识别度。

评分标准：
- 优秀(12-13分)：高度差异化和记忆点，具备强烈IP识别度
- 良好(10-11分)：有创新但不够突出，有一定辨识度
- 合格(7-9分)：中规中矩，与市面同类作品区分度不高
- 不合格(0-6分)：缺乏辨识度，容易与其他作品混淆

关键检查点：
- 与市面同类作品的差异化程度
- 核心创新点是否具有记忆性
- IP识别度和品牌潜力
- 创新元素是否有机融入世界观

### 维度5：叙事潜力与故事张力（满分13分）
评估剧情延展性、冲突丰富度、角色成长。

评分标准：
- 优秀(12-13分)：丰富延展性和多层次冲突，角色成长弧线清晰
- 良好(10-11分)：主线清晰有张力，有一定延展空间
- 合格(7-9分)：基础故事框架存在，但张力不足
- 不合格(0-6分)：叙事平淡，缺乏吸引力和延展性

关键检查点：
- 主线剧情的延展性和分支可能
- 核心冲突的丰富度和层次感
- 角色成长弧线的设计质量
- 支线故事的潜在空间

### 维度6：叙事落地可用性（满分13分）
评估世界观能否转化为清晰、可交付的区域文案、角色动机与系统短句。文案创作与玩法设计分离，本维度不得评价战斗机制、数值、技能、掉落或关卡功能。

评分标准：
- 优秀(12-13分)：宏观设定完整转化为区域事件、角色动机和精准短句，交付边界清晰
- 良好(10-11分)：主要设定均有具体叙事承载，少数文本仍可压缩或增强指向
- 合格(7-9分)：具备基本落地文本，但区域之间重复、松散或缺少推进
- 不合格(0-6分)：只有宏观设定，无法形成可交付的区域文案与角色文本

关键检查点：
- 宏观设定能否转化为具体区域事件与玩家可读文本
- 角色身份、动机和台词是否相互印证
- 区域进入提示与结束反馈是否简洁、明确且有推进作用
- 文案交付与外部玩法设计的职责边界是否清晰

**一票否决**：核心设定无法转化为任何区域事件、角色动机或玩家可读文本 → 直接0分

### 维度7：神系内部派系分化与冲突设计（满分12分）
评估神殿众神是否合理分化为多个派系，各派系间利益冲突、价值观差异、行为目的分歧是否清晰明确。

评分标准：
- 优秀(11-12分)：神系内部明确划分为多个派系，各派系有独特的利益诉求、价值观和行为目的，派系冲突能自然延伸至凡界格局并为剧情提供张力
- 良好(9-10分)：存在多个神系派系，派系间有明确的分歧和张力，但部分派系刻画较为粗略
- 合格(6-8分)：提及了神系内部存在分歧，但派系划分模糊或冲突缺乏深度
- 不合格(0-5分)：神殿众神完全为统一派别，无任何内部分化和冲突描述

关键检查点：
- 神殿众神是否明确划分为多个派系（至少2-3个）
- 各派系的利益诉求和核心目标是否有明确差异
- 派系间的价值观冲突是否有内在逻辑和说服力
- 神系派系分化对凡界格局和主线剧情的影响是否体现
- 派系冲突是否能转化为游戏叙事和玩法素材

**一票否决**：神殿众神完全为统一派别，无任何派系分化或内部冲突描述 → 直接0分

## 输出格式要求
必须使用以下【标记】格式输出评测结果：

【分数】X（0到满分之间的整数）
【等级】优秀/良好/合格/不合格
【评分理由】（详细说明评分依据，200-400字）
【关键问题】
- 问题1（如无则写"无"）
- 问题2
- 问题3
【改进建议】
- 建议1（如无则写"无"）
- 建议2
- 建议3

## 评测原则
1. 严格按标准评分，不随意给满分
2. 发现问题要明确指出，不回避
3. 建议要具体可操作，不泛泛而谈
4. 保持客观公正，不受个人偏好影响
5. 只评估叙事内容及其交付可用性，不越界评价玩法、数值和战斗机制
6. 重点关注神殿众神是否存在多派系分化，派系间冲突是否充分`
}

/**
 * 为指定维度构建评测用户提示词
 */
export function buildDimensionEvalPrompt(
  dimensionId: AssessmentDimensionId,
  dataSnapshot: string
): string {
  const dim = ASSESSMENT_DIMENSIONS.find(d => d.id === dimensionId)
  if (!dim) {
    throw new Error(`Unknown dimension: ${dimensionId}`)
  }

  return `请对以下西方魔幻塔防游戏世界观进行【${dim.displayName}】维度的专业评测。

## 评测维度
${dim.displayName}（满分${dim.weight}分）
${dim.description}

## 待评测的世界观数据
${dataSnapshot}

## 评测要求
1. 仔细阅读上述世界观数据
2. 根据系统提示词中的评分标准进行评分
3. 重点关注以下检查点：
${dim.checkPoints.map(cp => `- ${cp}`).join('\n')}

4. 严格按照【标记】格式输出评测结果
5. 评分理由要具体，引用世界观数据中的具体内容作为依据

请开始评测。`
}

/**
 * 构建Kimi2.5深度分析提示词
 */
export function buildKimiAnalysisPrompt(
  evalResults: Array<{
    provider: string
    modelName: string
    dimensions: Array<{
      dimension: AssessmentDimensionId
      displayName: string
      score: number
      maxScore: number
      grade: string
      reasoning: string
      keyIssues: string[]
      suggestions: string[]
    }>
    totalScore: number
    overallGrade: string
  }>,
  currentPrompts: Record<string, string>
): string {
  // 找出低分维度（低于满分的80%）
  const allDimensions = evalResults.flatMap(r => r.dimensions)
  const dimensionScores: Record<AssessmentDimensionId, number[]> = {
    'logic-consistency': [],
    'fantasy-adaptation': [],
    'completeness': [],
    'innovation': [],
    'narrative-potential': [],
    'tower-defense-fit': [],
    'deity-factions': []
  }

  allDimensions.forEach(d => {
    dimensionScores[d.dimension].push(d.score)
  })

  const avgScores = Object.entries(dimensionScores).map(([id, scores]) => ({
    id: id as AssessmentDimensionId,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    max: ASSESSMENT_DIMENSIONS.find(d => d.id === id)?.weight || 0
  }))

  const weakDimensions = avgScores.filter(d => d.avg < d.max * 0.8)

  const evalSummary = evalResults.map(r => `
【${r.modelName}】总分：${r.totalScore}/100，等级：${r.overallGrade}
各维度得分：
${r.dimensions.map(d => `- ${d.displayName}: ${d.score}/${d.maxScore} (${d.grade})`).join('\n')}
主要问题：
${r.dimensions.flatMap(d => d.keyIssues.filter(i => i && i !== '无').map(i => `- [${d.displayName}] ${i}`)).join('\n') || '无'}
`).join('\n---\n')

  return `你是一位资深的AI提示词工程师和游戏世界观专家。请对以下三模型评测结果进行深度分析，找出世界观设计问题的根因，并提出提示词优化建议。

## 三模型评测结果汇总
${evalSummary}

## 薄弱维度（平均分低于满分的80%）
${weakDimensions.length > 0 
  ? weakDimensions.map(d => `- ${ASSESSMENT_DIMENSIONS.find(x => x.id === d.id)?.displayName}: 平均分${d.avg.toFixed(1)}/${d.max}`).join('\n')
  : '无明显薄弱维度'
}

## 当前使用的提示词模板
${Object.entries(currentPrompts).map(([id, prompt]) => `
【${id}】
${prompt.slice(0, 500)}${prompt.length > 500 ? '...' : ''}
`).join('\n')}

## 分析任务
1. **问题根因分析**：为什么这些维度得分较低？是提示词设计问题、示例不足、还是约束不明确？
2. **模式识别**：三模型反馈中共同提到的问题是什么？
3. **优化策略**：针对每个薄弱维度，应该如何修改提示词？

## 输出格式
【深度分析】
（对评测结果的深度解读，300-500字）

【根因总结】
- 根因1
- 根因2
- 根因3

【优化方向】
- 方向1：具体说明如何修改提示词
- 方向2
- 方向3`
}

/**
 * 构建Kimi2.5提示词优化请求
 */
export function buildKimiOptimizePrompt(
  analysisResult: {
    analysis: string
    weakDimensions: AssessmentDimensionId[]
    rootCauses: string[]
  },
  phase: 1 | 2 | 3,
  currentPrompts: Record<string, string>
): string {
  const phaseNames: Record<number, string> = {
    1: '阶段一：世界框架与核心叙事',
    2: '阶段二：九大陆叙事设计',
    3: '阶段三：前三大陆落地'
  }

  const dimensionNames: Record<AssessmentDimensionId, string> = {
    'logic-consistency': '世界观内部逻辑一致性',
    'fantasy-adaptation': '西方魔幻背景适配度',
    'completeness': '设定完整性与系统性',
    'innovation': '创新性与独特识别度',
    'narrative-potential': '叙事潜力与故事张力',
    'tower-defense-fit': '叙事落地可用性',
    'deity-factions': '神系内部派系分化与冲突设计'
  }

  return `你是一位专业的AI提示词工程师。请基于以下深度分析结果，为${phaseNames[phase]}生成优化后的提示词。

## 薄弱维度
${analysisResult.weakDimensions.map(id => `- ${dimensionNames[id]}`).join('\n')}

## 问题根因
${analysisResult.rootCauses.map(c => `- ${c}`).join('\n')}

## 深度分析
${analysisResult.analysis}

## 当前提示词
${Object.entries(currentPrompts).map(([id, prompt]) => `
【${id}】
${prompt}
`).join('\n---\n')}

## 优化任务
请针对薄弱维度，对当前提示词进行优化：

1. **增强约束**：增加更具体的约束条件，避免低质量输出
2. **补充示例**：在必要时增加示例说明期望的输出质量
3. **强化检查点**：在提示词中明确列出质量检查点
4. **输出格式优化**：确保输出格式能够体现高质量内容

## 输出格式
为每个模块输出优化后的完整提示词：

【优化后：模块ID】
（优化后的完整提示词，包含system和user部分）

【优化说明】
- 优化点1：说明为什么这样修改
- 优化点2

请确保优化后的提示词：
- 保持原有的输出格式标记（【标记】风格）
- 不增加过多长度，保持简洁
- 针对薄弱维度有明确的改进
- 可以直接替换原有提示词使用`
}
