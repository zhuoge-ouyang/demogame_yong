import OpenAI from 'openai'
import type {
  EvalModelConfig,
  EvalProvider,
  AssessmentDimensionId,
  DimensionScore,
  ModelEvalResult,
  KimiAnalysisResult
} from '@/types/assessment'
import { ASSESSMENT_DIMENSIONS, getOverallGrade, getScoreGrade } from '@/constants/assessment'
import { getAssessmentSystemPrompt, buildDimensionEvalPrompt, buildKimiAnalysisPrompt, buildKimiOptimizePrompt } from './prompts/assessment-prompts'
import type { WorldState } from '@/types/world'
import type { ContinentsState } from '@/types/continent'
import type { LandingsState } from '@/types/landing'

/**
 * 创建评测专用的OpenAI客户端
 * 所有评测模型都使用OpenAI兼容格式
 */
function createEvalClient(config: EvalModelConfig): OpenAI {
  const options: any = {
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true
  }

  return new OpenAI(options)
}

/**
 * 获取实际发送给API的模型名
 * 豆包需要使用endpoint ID作为模型名
 */
function getModelName(config: EvalModelConfig): string {
  if (config.provider === 'doubao' && config.endpoint) {
    return config.endpoint
  }
  return config.model
}

/**
 * 调用评测模型进行单维度评分
 */
async function evaluateSingleDimension(
  client: OpenAI,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,  // 评测需要较低温度保证稳定性
    max_tokens: 2000
  })
  return response.choices[0]?.message?.content || ''
}

/**
 * 解析AI评测返回的结构化结果
 * 使用【标记】格式解析
 */
function parseEvalResponse(
  content: string,
  dimensionId: AssessmentDimensionId
): DimensionScore {
  const dim = ASSESSMENT_DIMENSIONS.find(d => d.id === dimensionId)!

  // 解析分数
  const scoreMatch = content.match(/【分数】\s*(\d+)/)
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0

  // 解析等级
  const gradeMatch = content.match(/【等级】\s*(\S+)/)
  const gradeText = gradeMatch ? gradeMatch[1].trim() : ''

  // 将中文等级转换为ScoreGrade
  let grade: 'excellent' | 'good' | 'pass' | 'fail'
  switch (gradeText) {
    case '优秀':
      grade = 'excellent'
      break
    case '良好':
      grade = 'good'
      break
    case '合格':
      grade = 'pass'
      break
    default:
      grade = 'fail'
  }

  // 解析理由
  const reasonMatch = content.match(/【评分理由】\s*([\s\S]*?)(?=【|$)/)
  const reasoning = reasonMatch ? reasonMatch[1].trim() : ''

  // 解析关键问题
  const issuesMatch = content.match(/【关键问题】\s*([\s\S]*?)(?=【|$)/)
  const keyIssues = issuesMatch
    ? issuesMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().replace(/^-\s*/, ''))
    : []

  // 解析建议
  const suggestionsMatch = content.match(/【改进建议】\s*([\s\S]*?)(?=【|$)/)
  const suggestions = suggestionsMatch
    ? suggestionsMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().replace(/^-\s*/, ''))
    : []

  return {
    dimension: dimensionId,
    displayName: dim.displayName,
    maxScore: dim.weight,
    score: Math.min(score, dim.weight), // 不超过满分
    grade,
    reasoning,
    keyIssues,
    suggestions
  }
}

/**
 * 收集Phase1世界观数据快照
 */
function collectPhase1Data(worldState: WorldState): string {
  const parts: string[] = ['=== Phase1: 世界框架与核心叙事 ===\n']

  // 三界结构
  parts.push('【三界结构】')
  parts.push(`概述：${worldState.realmStructure.summary || '（未填写）'}`)
  parts.push(`\n上界-过去：${worldState.realmStructure.upper.past || '（未填写）'}`)
  parts.push(`上界-现状：${worldState.realmStructure.upper.present || '（未填写）'}`)
  parts.push(`上界-未来：${worldState.realmStructure.upper.future || '（未填写）'}`)
  parts.push(`\n凡界-过去：${worldState.realmStructure.mortal.past || '（未填写）'}`)
  parts.push(`凡界-现状：${worldState.realmStructure.mortal.present || '（未填写）'}`)
  parts.push(`凡界-未来：${worldState.realmStructure.mortal.future || '（未填写）'}`)
  parts.push(`\n深渊-过去：${worldState.realmStructure.abyss.past || '（未填写）'}`)
  parts.push(`深渊-现状：${worldState.realmStructure.abyss.present || '（未填写）'}`)
  parts.push(`深渊-未来：${worldState.realmStructure.abyss.future || '（未填写）'}`)

  // 主线剧情
  parts.push('\n\n【主线剧情】')
  parts.push(`概述：${worldState.mainStoryline.overview || '（未填写）'}`)
  worldState.mainStoryline.stages.forEach((stage, i) => {
    parts.push(`\n阶段${i + 1}：${stage.name || '（未命名）'}`)
    parts.push(`- 目标：${stage.goal || '（未填写）'}`)
    parts.push(`- 关键事件：${stage.events || '（未填写）'}`)
    parts.push(`- 结局：${stage.resolution || '（未填写）'}`)
  })

  // 玩家身份
  parts.push('\n\n【玩家身份】')
  parts.push(`起源：${worldState.playerIdentity.origin || '（未填写）'}`)
  parts.push(`初始认知：${worldState.playerIdentity.initialPerception || '（未填写）'}`)
  parts.push(`揭示弧线：${worldState.playerIdentity.revelationArc || '（未填写）'}`)
  parts.push(`玩法整合：${worldState.playerIdentity.gameplayIntegration || '（未填写）'}`)

  // 英雄系统
  parts.push('\n\n【英雄系统】')
  worldState.heroSystem.forEach(hero => {
    parts.push(`\n${hero.element || '未知'}元素英雄：${hero.name || '（未命名）'}`)
    parts.push(`- 视觉：${hero.visual || '（未填写）'}`)
    parts.push(`- 性格：${hero.personality || '（未填写）'}`)
    parts.push(`- 背景：${hero.backstory || '（未填写）'}`)
    parts.push(`- 角色定位：${hero.role || '（未填写）'}`)
    parts.push(`- 加入条件：${hero.joinCondition || '（未填写）'}`)
  })

  // 城堡与女神
  parts.push('\n\n【城堡与女神】')
  parts.push(`城堡描述：${worldState.castleGoddess.castle.description || '（未填写）'}`)
  parts.push(`城堡意义：${worldState.castleGoddess.castle.significance || '（未填写）'}`)
  parts.push(`\n女神：${worldState.castleGoddess.goddess.name || '（未命名）'}`)
  parts.push(`- 外观：${worldState.castleGoddess.goddess.appearance || '（未填写）'}`)
  parts.push(`- 性格：${worldState.castleGoddess.goddess.personality || '（未填写）'}`)

  return parts.join('\n')
}

/**
 * 收集Phase2世界观数据快照
 */
function collectPhase2Data(continentsState: ContinentsState): string {
  const parts: string[] = ['=== Phase2: 九大陆叙事设计 ===\n']

  const continentNames: Record<string, string> = {
    jin: '金', mu: '木', bing: '冰', huo: '火',
    tu: '土', feng: '风', lei: '雷', guang: '光', an: '暗'
  }

  Object.entries(continentsState).forEach(([id, continent]) => {
    const cnName = continentNames[id] || id
    parts.push(`\n【${cnName}大陆】`)
    parts.push(`主线剧情：${continent.aspects.mainPlot || '（未填写）'}`)
    parts.push(`核心冲突：${continent.aspects.coreConflict || '（未填写）'}`)
    parts.push(`玩家目标：${continent.aspects.playerGoal || '（未填写）'}`)
    parts.push(`体验定位：${continent.aspects.experiencePositioning || '（未填写）'}`)
    parts.push(`游戏内表达：${continent.aspects.inGameExpression || '（未填写）'}`)
    parts.push(`主题表达：${continent.aspects.themeExpression || '（未填写）'}`)
    parts.push(`推进变化：${continent.aspects.playerProgressionChanges || '（未填写）'}`)
  })

  return parts.join('\n')
}

/**
 * 收集Phase3世界观数据快照
 */
function collectPhase3Data(landingState: LandingsState): string {
  const parts: string[] = ['=== Phase3: 前三大陆落地 ===\n']

  const continentNames: Record<string, string> = {
    jin: '金', bing: '冰', huo: '火'
  }

  Object.entries(landingState).forEach(([id, continent]) => {
    const cnName = continentNames[id] || id
    parts.push(`\n【${cnName}大陆落地内容】`)

    parts.push('\n进入提示：')
    parts.push(`- 叙事：${continent.entryPrompt.narrative || '（未填写）'}`)
    parts.push(`- NPC对话：${continent.entryPrompt.npcDialogue || '（未填写）'}`)
    parts.push(`- 氛围：${continent.entryPrompt.atmosphere || '（未填写）'}`)

    parts.push('\n通关反馈：')
    parts.push(`- 叙事：${continent.completionFeedback.narrative || '（未填写）'}`)
    parts.push(`- 奖励故事：${continent.completionFeedback.rewardStory || '（未填写）'}`)
    parts.push(`- 过渡文本：${continent.completionFeedback.transitionText || '（未填写）'}`)

    parts.push('\nBoss设计：')
    continent.bosses.forEach((boss, i) => {
      parts.push(`\nBoss ${i + 1}：${boss.name || '（未命名）'}`)
      parts.push(`- 身份：${boss.identity || '（未填写）'}`)
      parts.push(`- 动机：${boss.motivation || '（未填写）'}`)
      parts.push(`- 标志性台词：${boss.signatureLine || '（未填写）'}`)
      parts.push(`- 开场设计：${boss.openingScene || '（未填写）'}`)
      parts.push(`- 故事关联：${boss.storyConnection || '（未填写）'}`)
    })

    parts.push('\n关卡节点：')
    continent.levelNodes.forEach((node, i) => {
      parts.push(`\n节点 ${i + 1}：${node.name || '（未命名）'}`)
      parts.push(`- 故事节拍：${node.storyBeat || '（未填写）'}`)
      parts.push(`- 关键遭遇：${node.keyEncounter || '（未填写）'}`)
      parts.push(`- 叙事奖励：${node.narrativeReward || '（未填写）'}`)
    })
  })

  return parts.join('\n')
}

/**
 * 收集指定阶段的世界观数据快照
 * 根据phase参数聚合不同store的数据
 */
function collectPhaseData(
  phase: 1 | 2 | 3,
  worldState?: WorldState,
  continentsState?: ContinentsState,
  landingState?: LandingsState
): string {
  const parts: string[] = []

  if (phase >= 1 && worldState) {
    parts.push(collectPhase1Data(worldState))
  }

  if (phase >= 2 && continentsState) {
    parts.push('\n\n' + '='.repeat(50) + '\n')
    parts.push(collectPhase2Data(continentsState))
  }

  if (phase >= 3 && landingState) {
    parts.push('\n\n' + '='.repeat(50) + '\n')
    parts.push(collectPhase3Data(landingState))
  }

  return parts.join('\n')
}

/**
 * 生成模型评测摘要
 */
function generateModelSummary(dimensions: DimensionScore[], totalScore: number): string {
  const weakDims = dimensions.filter(d => d.score < d.maxScore * 0.8)
  const strongDims = dimensions.filter(d => d.grade === 'excellent')

  let summary = `总分${totalScore}/100。`
  if (strongDims.length > 0) {
    summary += `优势维度：${strongDims.map(d => d.displayName).join('、')}。`
  }
  if (weakDims.length > 0) {
    summary += `薄弱维度：${weakDims.map(d => `${d.displayName}(${d.score}/${d.maxScore})`).join('、')}。`
  }
  return summary
}

/**
 * 用单个模型执行完整7维度评测
 * onProgress 回调用于更新UI进度
 */
async function evaluateWithModel(
  config: EvalModelConfig,
  dataSnapshot: string,
  onProgress?: (dimensionId: AssessmentDimensionId) => void
): Promise<ModelEvalResult> {
  const client = createEvalClient(config)
  const modelName = getModelName(config)
  const systemPrompt = getAssessmentSystemPrompt()

  const dimensions: DimensionScore[] = []

  for (const dim of ASSESSMENT_DIMENSIONS) {
    const userPrompt = buildDimensionEvalPrompt(dim.id, dataSnapshot)
    const response = await evaluateSingleDimension(client, modelName, systemPrompt, userPrompt)
    const score = parseEvalResponse(response, dim.id)
    dimensions.push(score)
    onProgress?.(dim.id)
  }

  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0)

  return {
    provider: config.provider as EvalProvider,
    modelName: config.label,
    dimensions,
    totalScore,
    overallGrade: getOverallGrade(totalScore),
    summary: generateModelSummary(dimensions, totalScore),
    timestamp: Date.now()
  }
}

/**
 * 执行完整评测流程（3个模型并行）
 * 返回所有模型的评测结果
 */
async function runFullAssessment(
  configs: EvalModelConfig[],
  dataSnapshot: string,
  onModelProgress?: (provider: EvalProvider, dimensionId: AssessmentDimensionId) => void
): Promise<ModelEvalResult[]> {
  const results = await Promise.allSettled(
    configs.filter(c => c.enabled).map(config =>
      evaluateWithModel(config, dataSnapshot, (dimId) => {
        onModelProgress?.(config.provider as EvalProvider, dimId)
      })
    )
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ModelEvalResult> => r.status === 'fulfilled')
    .map(r => r.value)
}

/**
 * 调用Kimi 2.5进行深度分析
 */
async function runKimiAnalysis(
  kimiConfig: EvalModelConfig,
  evalResults: ModelEvalResult[],
  currentPrompts: Record<string, string>,
  phase: 1 | 2 | 3
): Promise<KimiAnalysisResult> {
  const client = createEvalClient(kimiConfig)
  const modelName = getModelName(kimiConfig)

  // 构建分析提示词
  const userPrompt = buildKimiAnalysisPrompt(evalResults, currentPrompts)

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'system',
        content: '你是一位资深的AI提示词工程师和游戏世界观专家，擅长分析AI评测结果并找出问题根因。'
      },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.5,
    max_tokens: 4000
  })

  const content = response.choices[0]?.message?.content || ''

  // 解析分析结果
  const analysisMatch = content.match(/【深度分析】\s*([\s\S]*?)(?=【|$)/)
  const analysis = analysisMatch ? analysisMatch[1].trim() : content

  // 解析根因
  const rootCausesMatch = content.match(/【根因总结】\s*([\s\S]*?)(?=【|$)/)
  const rootCauses = rootCausesMatch
    ? rootCausesMatch[1].trim().split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().replace(/^-\s*/, ''))
    : []

  // 识别薄弱维度（从evalResults中计算）
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

  const weakDimensions = avgScores
    .filter(d => d.avg < d.max * 0.8)
    .map(d => d.id)

  // 调用优化提示词生成
  const optimizePrompt = buildKimiOptimizePrompt(
    { analysis, weakDimensions, rootCauses },
    phase,
    currentPrompts
  )

  const optimizeResponse = await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'system',
        content: '你是一位专业的AI提示词工程师，擅长优化提示词模板以提升AI输出质量。'
      },
      { role: 'user', content: optimizePrompt }
    ],
    temperature: 0.5,
    max_tokens: 6000
  })

  const optimizeContent = optimizeResponse.choices[0]?.message?.content || ''

  // 解析优化后的提示词
  const optimizedPrompts: Record<string, string> = {}
  const moduleMatches = [...optimizeContent.matchAll(/【优化后：([^】]+)】\s*([\s\S]*?)(?=【优化后：|【优化说明】|$)/g)]
  for (const match of moduleMatches) {
    const moduleId = match[1].trim()
    const prompt = match[2].trim()
    if (moduleId && prompt) {
      optimizedPrompts[moduleId] = prompt
    }
  }

  return {
    analysis,
    weakDimensions,
    rootCauses,
    optimizedPrompts,
    timestamp: Date.now()
  }
}

/**
 * 测试模型连接是否有效
 */
async function testConnection(config: EvalModelConfig): Promise<{ success: boolean; message: string }> {
  try {
    const client = createEvalClient(config)
    const modelName = getModelName(config)
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: '请回复"连接成功"' }],
      max_tokens: 10
    })
    if (response.choices[0]?.message?.content) {
      return { success: true, message: '连接成功' }
    }
    return { success: false, message: '未获取到有效响应' }
  } catch (e: any) {
    return { success: false, message: e.message || '连接失败' }
  }
}

export {
  evaluateWithModel,
  runFullAssessment,
  runKimiAnalysis,
  testConnection,
  collectPhaseData,
  parseEvalResponse,
  createEvalClient,
  getModelName
}
