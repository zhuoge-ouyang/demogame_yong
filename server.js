import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import session from 'express-session'
import { registerPptRoutes } from './ppt-routes.js'
import http from 'http'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}

function loadUsersFromEnv() {
  const raw = requireEnv('APP_USERS_JSON')
  let users
  try {
    users = JSON.parse(raw)
  } catch (error) {
    throw new Error('APP_USERS_JSON must be valid JSON')
  }
  if (!Array.isArray(users) || users.some(user =>
    !user ||
    typeof user.username !== 'string' ||
    typeof user.password !== 'string' ||
    !['admin', 'client'].includes(user.role)
  )) {
    throw new Error('APP_USERS_JSON must be an array of { username, password, role }')
  }
  return users
}

const SESSION_SECRET = requireEnv('SESSION_SECRET')
const USERS = loadUsersFromEnv()

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// express-session 中间件
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24小时
}))

// AI API 代理配置 - 与 vite.config.ts 中的代理配置保持一致
const AI_PROXY_MAP = {
  '/proxy/moonshot': { target: 'api.moonshot.cn', protocol: 'https' },
  '/proxy/openai': { target: 'api.openai.com', protocol: 'https' },
  '/proxy/anthropic': { target: 'api.anthropic.com', protocol: 'https' },
  '/proxy/dashscope': { target: 'dashscope.aliyuncs.com', protocol: 'https' },
  '/proxy/volces': { target: 'ark.cn-beijing.volces.com', protocol: 'https' },
  '/proxy/minimax': { target: 'api.minimax.chat', protocol: 'https' }
}

// AI API 代理中间件
function aiProxyMiddleware(req, res, next) {
  // 检查是否匹配代理路径
  const proxyEntry = Object.entries(AI_PROXY_MAP).find(([path]) => 
    req.path.startsWith(path)
  )
  
  if (!proxyEntry) {
    return next()
  }

  if (!req.session?.user) {
    return res.status(401).json({ error: '未登录' })
  }

  const [proxyPath, config] = proxyEntry
  const targetPath = req.path.replace(proxyPath, '')
  const targetUrl = `${config.protocol}://${config.target}${targetPath}`
  
  console.log(`[AI Proxy] ${req.method} ${req.path} -> ${targetUrl}`)

  const options = {
    hostname: config.target,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: config.target
    }
  }

  // 删除可能导致问题的 headers
  delete options.headers['connection']
  delete options.headers['upgrade']

  const proxyReq = (config.protocol === 'https' ? https : http).request(options, (proxyRes) => {
    res.status(proxyRes.statusCode)
    
    // 复制响应 headers
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (value) res.setHeader(key, value)
    })

    // 设置 CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access')

    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error(`[AI Proxy Error] ${err.message}`)
    res.status(502).json({ error: '代理请求失败', message: err.message })
  })

  // 处理请求 body
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = JSON.stringify(req.body)
    proxyReq.setHeader('Content-Type', 'application/json')
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
    proxyReq.write(bodyData)
  }

  req.pipe(proxyReq)
}

// AI API 代理路由（必须在静态文件服务之前注册）
app.use(aiProxyMiddleware)

// 处理 AI 代理的 OPTIONS 预检请求
app.options('/proxy/{*path}', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access')
  res.status(204).end()
})

// 数据版本号（内存维护，每次保存递增）
const dataVersions = {}
const VALID_KEYS = ['world', 'continents', 'landing', 'history', 'world-avatar', 'continents-avatar', 'landing-avatar', 'history-avatar']
VALID_KEYS.forEach(key => { dataVersions[key] = 0 })
const JIN_KNIGHT_VISUAL = '金耀骑士团团长，身披狮徽重型骑士板甲与金白披风；狮冠头盔下是冷峻坚毅的面庞，左臂持塔盾，右手握重剑，像一道不可后退的金色城门。'

// 认证端点
// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = USERS.find(u => u.username === username && u.password === password)
  if (user) {
    req.session.user = { username: user.username, role: user.role }
    res.json({ success: true, username: user.username, role: user.role })
  } else {
    res.status(401).json({ success: false, message: '用户名或密码错误' })
  }
})

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true })
  })
})

// GET /api/auth/check
app.get('/api/auth/check', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, username: req.session.user.username, role: req.session.user.role })
  } else {
    res.json({ authenticated: false })
  }
})

// GET /api/data/versions - 获取数据版本号
app.get('/api/data/versions', requireAuth, (req, res) => {
  res.json(dataVersions)
})

// 认证中间件
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next()
  } else {
    res.status(401).json({ error: '未登录' })
  }
}

// 数据存储目录
const DATA_DIR = path.join(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 数据文件路径（基础key）
const BASE_DATA_KEYS = ['world', 'continents', 'landing', 'history']

// 允许的数据 key（包含 avatar 版本）
const ALLOWED_KEYS = new Set([
  ...BASE_DATA_KEYS,
  ...BASE_DATA_KEYS.map(k => `${k}-avatar`)
])

// 根据 key 获取文件路径
function getDataFilePath(key) {
  if (!ALLOWED_KEYS.has(key)) return null
  return path.join(DATA_DIR, `${key}.json`)
}

// 读取数据
function readData(key) {
  const filePath = getDataFilePath(key)
  if (!filePath || !fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

const PROTECTED_WORLD_FIELDS = [
  { moduleName: 'realmStructure', fieldPath: 'summary' },
  { moduleName: 'realmStructure', fieldPath: 'upper.past' },
  { moduleName: 'realmStructure', fieldPath: 'upper.present' },
  { moduleName: 'realmStructure', fieldPath: 'mortal.present' },
  { moduleName: 'realmStructure', fieldPath: 'abyss.present' },
  { moduleName: 'mainStoryline', fieldPath: 'overview' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.name' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.goal' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.events' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.resolution' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.name' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.goal' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.events' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.resolution' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.name' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.goal' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.events' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.resolution' },
  { moduleName: 'playerIdentity', fieldPath: 'initialPerception' },
  { moduleName: 'playerIdentity', fieldPath: 'revelationArc' },
  { moduleName: 'playerIdentity', fieldPath: 'gameplayIntegration' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.name' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.guidanceStyle' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.dialogueThemes' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.truthMatrix' },
  { moduleName: 'heroSystem', fieldPath: 'jin.name' },
  { moduleName: 'heroSystem', fieldPath: 'jin.element' },
  { moduleName: 'heroSystem', fieldPath: 'jin.continent' },
  { moduleName: 'heroSystem', fieldPath: 'jin.visual' },
  { moduleName: 'heroSystem', fieldPath: 'jin.personality' },
  { moduleName: 'heroSystem', fieldPath: 'jin.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'jin.role' },
  { moduleName: 'heroSystem', fieldPath: 'jin.joinCondition' },
  { moduleName: 'heroSystem', fieldPath: 'jin.joinStage' },
  { moduleName: 'heroSystem', fieldPath: 'jin.storyRole' },
  { moduleName: 'heroSystem', fieldPath: 'bing.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'huo.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'mu.name' },
  { moduleName: 'heroSystem', fieldPath: 'mu.element' },
  { moduleName: 'heroSystem', fieldPath: 'mu.continent' },
  { moduleName: 'heroSystem', fieldPath: 'mu.visual' },
  { moduleName: 'heroSystem', fieldPath: 'mu.personality' },
  { moduleName: 'heroSystem', fieldPath: 'mu.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'mu.role' },
  { moduleName: 'heroSystem', fieldPath: 'mu.joinCondition' },
  { moduleName: 'heroSystem', fieldPath: 'mu.joinStage' },
  { moduleName: 'heroSystem', fieldPath: 'mu.storyRole' }
]

function getFieldEditedAt(data, moduleName, fieldPath) {
  const value = data?._meta?.[moduleName]?.[fieldPath]?.lastEditedAt
  return typeof value === 'number' ? value : 0
}

function getNestedString(data, moduleName, fieldPath) {
  let current = data?.[moduleName]
  for (const part of fieldPath.split('.')) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(part)
        ? current[Number(part)]
        : current.find(item => item?.id === part)
    } else {
      current = current?.[part]
    }
  }
  return typeof current === 'string' ? current : ''
}

function setNestedString(data, moduleName, fieldPath, value) {
  let current = data[moduleName] ||= {}
  const parts = fieldPath.split('.')
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(part)
        ? (current[Number(part)] ||= {})
        : current.find(item => item?.id === part)
      if (!current) return
    } else {
      current = current[part] ||= {}
    }
  }
  current[parts[parts.length - 1]] = value
}

function includesAny(value, terms) {
  return terms.some(term => value.includes(term))
}

function compactTextLength(value) {
  return typeof value === 'string' ? [...value.replace(/\s/g, '')].length : 0
}

const PHASE2_FIELD_MIN_LENGTHS = {
  mainPlot: 500,
  coreConflict: 140,
  playerGoal: 180,
  experiencePositioning: 180,
  inGameExpression: 300,
  themeExpression: 150,
  playerProgressionChanges: 260
}

const PHASE2_CHAPTER_ALIGNMENT_MARKERS = [
  ['jin', 'mainPlot', '方舟堡在艾蕾尼娅指引下随奥里克返回金耀大陆'],
  ['jin', 'playerGoal', '回乡侦查与救援'],
  ['mu', 'mainPlot', '方舟堡苏醒章'],
  ['mu', 'playerGoal', '第一次苏醒与外围防御'],
  ['bing', 'mainPlot', '融冰救境'],
  ['bing', 'playerGoal', '孤立守护转为正式同盟'],
  ['huo', 'mainPlot', '不死鸟失控'],
  ['huo', 'playerGoal', '控制不死鸟兽形'],
  ['tu', 'mainPlot', '佩特拉·磐心'],
  ['feng', 'mainPlot', '泽菲尔·逐风'],
  ['lei', 'mainPlot', '托尔加·雷铸'],
  ['guang', 'mainPlot', '卢西恩·晓誓'],
  ['an', 'mainPlot', '诺克丝·影棘']
]

function hasPhase1AlignedOpeningContinents(data) {
  if (!data || typeof data !== 'object') return false
  return PHASE2_CHAPTER_ALIGNMENT_MARKERS.every(([continentId, field, marker]) => (
    typeof data[continentId]?.aspects?.[field] === 'string'
      && data[continentId].aspects[field].includes(marker)
  ))
}

function countStalePhase2Fields(data) {
  if (!data || typeof data !== 'object') return 0
  const continentIds = ['jin', 'mu', 'bing', 'huo', 'tu', 'feng', 'lei', 'guang', 'an']
  let staleCount = 0
  for (const id of continentIds) {
    const aspects = data[id]?.aspects || {}
    for (const [field, minLength] of Object.entries(PHASE2_FIELD_MIN_LENGTHS)) {
      if (compactTextLength(aspects[field]) < minLength) staleCount++
    }
  }
  return staleCount
}

function hasThinPhase2Package(data) {
  if (!data || typeof data !== 'object') return false
  const continentIds = ['jin', 'mu', 'bing', 'huo', 'tu', 'feng', 'lei', 'guang', 'an']
  return continentIds.some(id => {
    const aspects = data[id]?.aspects || {}
    const total = Object.keys(PHASE2_FIELD_MIN_LENGTHS)
      .reduce((sum, field) => sum + compactTextLength(aspects[field]), 0)
    return total < 1900
  })
}

function isExpandedPhase2Continents(data) {
  return countStalePhase2Fields(data) === 0 && !hasThinPhase2Package(data)
}

function isStalePhase2Continents(data) {
  return countStalePhase2Fields(data) >= 9 || hasThinPhase2Package(data)
}

function latestPhase2EditAt(data) {
  if (!data || typeof data !== 'object') return 0
  const continentIds = ['jin', 'mu', 'bing', 'huo', 'tu', 'feng', 'lei', 'guang', 'an']
  let latest = 0
  for (const id of continentIds) {
    const meta = data[id]?._meta
    if (!meta || typeof meta !== 'object') continue
    for (const value of Object.values(meta)) {
      const editedAt = Number(value?.lastEditedAt)
      if (Number.isFinite(editedAt) && editedAt > latest) latest = editedAt
    }
  }
  return latest
}

function hasNewerPhase2Edits(candidate, baseline) {
  return latestPhase2EditAt(candidate) > latestPhase2EditAt(baseline)
}

function hasOlderPhase2Edits(candidate, baseline) {
  return latestPhase2EditAt(candidate) < latestPhase2EditAt(baseline)
}

function preserveExpandedPhase2Continents(key, incomingData) {
  if (key !== 'continents' && key !== 'continents-avatar') return incomingData
  if (!incomingData || typeof incomingData !== 'object') return incomingData

  const existingData = readData(key)
  if (hasNewerPhase2Edits(incomingData, existingData)) {
    return incomingData
  }

  if (hasOlderPhase2Edits(incomingData, existingData)) {
    console.log(`[data-guard] 阻止较旧的第二阶段大陆数据覆盖当前用户稿 (${key})`)
    return existingData
  }

  if (isExpandedPhase2Continents(existingData) && isStalePhase2Continents(incomingData)) {
    console.log(`[data-guard] 阻止旧版第二阶段大陆缓存覆盖服务器扩写版 (${key})`)
    return existingData
  }

  if (hasPhase1AlignedOpeningContinents(existingData) && !hasPhase1AlignedOpeningContinents(incomingData)) {
    console.log(`[data-guard] 阻止未对齐阶段一前三章的第二阶段大陆缓存覆盖服务器定稿版 (${key})`)
    return existingData
  }

  return incomingData
}

function numberedEventCount(value) {
  return (value.match(/^\s*\d+\./gm) || []).length
}

function protectedFieldKey(field) {
  return `${field.moduleName}.${field.fieldPath}`
}

const LEGACY_FOREST_SPEAKER = '\u68ee\u8bed\u8005'
const ROOT_SPEAKER_FULL_NAME = '根语者（The Root Speaker）'

function hasGuidingGoddessCanon(value) {
  return value.includes('艾蕾尼娅')
    && includesAny(value, ['始终', '一直', '从未离开', '永远不会离开'])
    && includesAny(value, ['指导玩家行动', '指导关键行动', '行动建议', '行动方向', '指引'])
}

function isStaleProtectedCanon(field, value) {
  if (!value) return false
  const key = protectedFieldKey(field)

  if (key.startsWith('mainStoryline.stages.0.')) {
    if (includesAny(value, ['金耀大陆', '希尔凡', '希尔瓦拉', LEGACY_FOREST_SPEAKER])) return true
    if (key.endsWith('.name')) return !value.includes('翠森大陆')
    if (key.endsWith('.goal')) return !value.includes('根语者') || !value.includes('方舟堡')
    if (key.endsWith('.events')) {
      return numberedEventCount(value) !== 3
        || compactTextLength(value) > 600
        || !value.includes('根语者')
        || !value.includes('第一波深渊怪物')
        || !value.includes('奥里克·铸金')
        || !value.includes('塞琳娜·霜誓')
        || !value.includes('伊格纳修斯·焚誓')
    }
    if (key.endsWith('.resolution')) return includesAny(value, ['金耀大陆', '希尔凡', LEGACY_FOREST_SPEAKER])
  }

  if (key.startsWith('mainStoryline.stages.1.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return !value.includes('塞琳娜·霜誓') || !includesAny(value, ['巨大环境问题', '领地', '永冻层大片融化', '冰湖倒灌'])
    }
  }

  if (key.startsWith('mainStoryline.stages.2.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return !value.includes('伊格纳修斯·焚誓')
        || !value.includes('不死鸟')
        || !value.includes('失去理智')
        || !includesAny(value, ['伤害自己', '灼伤自己', '烧伤自己'])
        || !includesAny(value, ['身边人', '盟友'])
    }
  }

  if (key.startsWith('playerIdentity.')) {
    return includesAny(value, [LEGACY_FOREST_SPEAKER, '希尔凡', '希尔瓦拉'])
  }

  if (key === 'castleGoddess.goddess.name') return value !== '艾蕾尼娅（Elennia）'
  if (key.startsWith('castleGoddess.goddess.')) {
    return !hasGuidingGoddessCanon(value)
  }

  if (key === 'heroSystem.jin.name') return !value.includes('奥里克·铸金')
  if (key === 'heroSystem.jin.element') return value !== '金'
  if (key === 'heroSystem.jin.continent') return value !== '金耀大陆'
  if (key === 'heroSystem.jin.visual') {
    return !value.includes('骑士')
      || includesAny(value, ['魁梧沉默的铸造师', '铸金铠甲', '金属脉络', '熔金般'])
  }
  if (key.startsWith('heroSystem.jin.')) {
    return includesAny(value, ['魁梧沉默的铸造师', '前锋长', '铸造师的判断'])
  }

  if (key === 'heroSystem.bing.backstory') {
    return !value.includes('叔叔') || !value.includes('弗洛斯特')
  }
  if (key === 'heroSystem.huo.backstory') {
    return !value.includes('毁灭火核') || !value.includes('族人故意')
  }

  if (key === 'heroSystem.mu.name') return value !== ROOT_SPEAKER_FULL_NAME
  if (key === 'heroSystem.mu.element') return value !== '森'
  if (key === 'heroSystem.mu.continent') return value !== '翠森大陆'
  if (key.startsWith('heroSystem.mu.')) {
    return includesAny(value, ['希尔凡', '希尔瓦拉', LEGACY_FOREST_SPEAKER, '翠棘卫队', '木元素'])
  }

  return false
}

function isCurrentProtectedCanon(field, value) {
  if (!value || isStaleProtectedCanon(field, value)) return false
  const key = protectedFieldKey(field)

  if (key.startsWith('mainStoryline.stages.0.')) {
    if (key.endsWith('.name')) return value.includes('翠森大陆')
    if (key.endsWith('.goal')) return value.includes('根语者') && value.includes('方舟堡')
    if (key.endsWith('.events')) {
      return numberedEventCount(value) === 3
        && compactTextLength(value) >= 300
        && compactTextLength(value) <= 500
        && value.includes('第一波深渊怪物')
    }
    return value.includes('方舟堡') || value.includes('根语者')
  }

  if (key.startsWith('mainStoryline.stages.1.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return value.includes('塞琳娜·霜誓') && includesAny(value, ['巨大环境问题', '领地', '永冻层大片融化', '冰湖倒灌'])
    }
    return true
  }

  if (key.startsWith('mainStoryline.stages.2.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return value.includes('伊格纳修斯·焚誓')
        && value.includes('不死鸟')
        && value.includes('失去理智')
        && includesAny(value, ['伤害自己', '灼伤自己', '烧伤自己'])
        && includesAny(value, ['身边人', '盟友'])
    }
    return true
  }

  if (key.startsWith('playerIdentity.')) {
    return value.includes('方舟堡') || value.includes('玩家')
  }

  if (key === 'castleGoddess.goddess.name') return value === '艾蕾尼娅（Elennia）'
  if (key.startsWith('castleGoddess.goddess.')) {
    return hasGuidingGoddessCanon(value)
  }

  if (key === 'heroSystem.jin.name') return value.includes('奥里克·铸金')
  if (key === 'heroSystem.jin.element') return value === '金'
  if (key === 'heroSystem.jin.continent') return value === '金耀大陆'
  if (key === 'heroSystem.jin.visual') return value.includes('骑士团团长') && value.includes('骑士板甲')
  if (key.startsWith('heroSystem.jin.')) {
    return value.includes('骑士团团长') || value.includes('金耀骑士团长')
  }

  if (key === 'heroSystem.bing.backstory') {
    return value.includes('塞琳娜·霜誓') && value.includes('叔叔') && value.includes('弗洛斯特')
  }
  if (key === 'heroSystem.huo.backstory') {
    return value.includes('伊格纳修斯·焚誓') && value.includes('毁灭火核') && value.includes('族人故意')
  }

  if (key === 'heroSystem.mu.name') return value === ROOT_SPEAKER_FULL_NAME
  if (key === 'heroSystem.mu.element') return value === '森'
  if (key === 'heroSystem.mu.continent') return value === '翠森大陆'
  if (key.startsWith('heroSystem.mu.')) {
    return includesAny(value, ['根语者', '根系', '根脉', '根须', '方舟堡', '玩家意识'])
  }

  return true
}

function shouldPreserveProtectedField(field, existingContent, incomingContent, existingEditedAt, incomingEditedAt) {
  if (!existingContent) return false
  if (existingEditedAt > incomingEditedAt) return true
  return isStaleProtectedCanon(field, incomingContent) && isCurrentProtectedCanon(field, existingContent)
}

function preserveNewerProtectedFields(key, incomingData) {
  if (key !== 'world' && key !== 'world-avatar') return incomingData
  if (!incomingData || typeof incomingData !== 'object') return incomingData

  const existingData = readData(key)
  if (!existingData) return incomingData

  let safeData = incomingData
  const preservedFields = []

  for (const field of PROTECTED_WORLD_FIELDS) {
    const existingEditedAt = getFieldEditedAt(existingData, field.moduleName, field.fieldPath)
    const incomingEditedAt = getFieldEditedAt(incomingData, field.moduleName, field.fieldPath)
    const existingContent = getNestedString(existingData, field.moduleName, field.fieldPath)
    const incomingContent = getNestedString(incomingData, field.moduleName, field.fieldPath)

    if (!shouldPreserveProtectedField(field, existingContent, incomingContent, existingEditedAt, incomingEditedAt)) continue

    if (safeData === incomingData) {
      safeData = JSON.parse(JSON.stringify(incomingData))
    }
    setNestedString(safeData, field.moduleName, field.fieldPath, existingContent)
    safeData._meta ||= {}
    safeData._meta[field.moduleName] ||= {}
    safeData._meta[field.moduleName][field.fieldPath] = existingData._meta?.[field.moduleName]?.[field.fieldPath]
    preservedFields.push(`${field.moduleName}.${field.fieldPath}`)
  }

  if (preservedFields.length > 0) {
    console.log(`[data-guard] 保留服务器较新的字段 (${key}): ${preservedFields.join(', ')}`)
  }

  return safeData
}

function normalizeGoldHeroCanon(data) {
  const goldHero = data?.heroSystem?.find?.(hero => hero.id === 'jin')
  if (!goldHero) return data
  if (isStaleProtectedCanon({ moduleName: 'heroSystem', fieldPath: 'jin.visual' }, goldHero.visual)) {
    goldHero.visual = JIN_KNIGHT_VISUAL
  }
  return data
}

// 写入数据
function writeData(key, data) {
  const filePath = getDataFilePath(key)
  if (!filePath) return false
  try {
    const safeData = normalizeGoldHeroCanon(preserveExpandedPhase2Continents(key, preserveNewerProtectedFields(key, data)))
    fs.writeFileSync(filePath, JSON.stringify(safeData, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

// 意见数据文件路径
const OPINIONS_FILE = path.join(DATA_DIR, 'opinions.json')

// 日志数据文件路径
const LOG_FILE = path.join(DATA_DIR, 'edit-logs.json')

// 快照目录
const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots')

// 中文序数映射
const ORDINAL_ZH = ['一','二','三','四','五','六','七','八','九','十']
function roundLabel(n) {
  return `第${ORDINAL_ZH[n - 1] || n}次意见`
}

// 读取意见数据（新格式：{ rounds: [...] }）
// 自动迁移旧格式 { settings, plot, finalized } → rounds
function readOpinions() {
  try {
    if (fs.existsSync(OPINIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(OPINIONS_FILE, 'utf-8'))
      // 已是新格式
      if (Array.isArray(raw.rounds)) return raw
      // 旧格式迁移：将 settings/plot/finalized 映射为 round 1/2/3
      const rounds = []
      let id = 1
      for (const val of Object.values(raw)) {
        if (val && typeof val === 'object') {
          rounds.push({
            id,
            label: roundLabel(id),
            content: val.content || '',
            updatedAt: val.updatedAt || null,
            updatedBy: val.updatedBy || ''
          })
          id++
        }
      }
      return { rounds }
    }
  } catch (e) {
    console.error('读取意见数据失败:', e)
  }
  // 默认初始化 3 轮
  return {
    rounds: [
      { id: 1, label: roundLabel(1), content: '', updatedAt: null, updatedBy: '' },
      { id: 2, label: roundLabel(2), content: '', updatedAt: null, updatedBy: '' },
      { id: 3, label: roundLabel(3), content: '', updatedAt: null, updatedBy: '' }
    ]
  }
}

// 读取日志数据
function readLogs() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('读取日志失败:', e)
  }
  return []
}

// 写入日志数据
function writeLogs(logs) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8')
}

// GET /api/opinions
app.get('/api/opinions', requireAuth, (req, res) => {
  const data = readOpinions()
  res.json(data)
})

// POST /api/opinions - 保存指定轮次意见
app.post('/api/opinions', requireAuth, (req, res) => {
  const { roundId, content } = req.body
  if (typeof roundId !== 'number') {
    return res.status(400).json({ error: '无效的 roundId' })
  }
  const data = readOpinions()
  const round = data.rounds.find(r => r.id === roundId)
  if (!round) return res.status(404).json({ error: `轮次 ${roundId} 不存在` })
  round.content = content || ''
  round.updatedAt = new Date().toISOString()
  round.updatedBy = req.session.user.username
  fs.writeFileSync(OPINIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  res.json({ success: true, round })
})

// POST /api/opinions/add-round - 新增一轮意见
app.post('/api/opinions/add-round', requireAuth, (req, res) => {
  const data = readOpinions()
  const maxId = data.rounds.reduce((m, r) => Math.max(m, r.id), 0)
  const newId = maxId + 1
  const newRound = { id: newId, label: roundLabel(newId), content: '', updatedAt: null, updatedBy: '' }
  data.rounds.push(newRound)
  fs.writeFileSync(OPINIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  res.json({ success: true, round: newRound })
})

// GET /api/logs - 获取日志（支持分页，按时间倒序）
app.get('/api/logs', requireAuth, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 50
    const logs = readLogs()
    // 按时间倒序
    logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    const total = logs.length
    const start = (page - 1) * pageSize
    const items = logs.slice(start, start + pageSize)
    res.json({ items, total, page, pageSize })
  } catch (e) {
    console.error('获取日志失败:', e)
    res.status(500).json({ error: '获取日志失败' })
  }
})

// POST /api/logs - 新增日志条目
app.post('/api/logs', requireAuth, (req, res) => {
  try {
    const { moduleName, fieldPath, fieldLabel, oldContent, newContent } = req.body
    if (!moduleName || !fieldPath) {
      return res.status(400).json({ error: '缺少必填字段' })
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      username: req.session.user.username,
      timestamp: Date.now(),
      moduleName,
      fieldPath,
      fieldLabel: fieldLabel || `${moduleName}.${fieldPath}`,
      oldContent: oldContent || '',
      newContent: newContent || ''
    }
    const logs = readLogs()
    logs.push(entry)
    // 限制最多保留 1000 条日志
    if (logs.length > 1000) {
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      logs.length = 1000
    }
    writeLogs(logs)
    res.json({ success: true, entry })
  } catch (e) {
    console.error('保存日志失败:', e)
    res.status(500).json({ error: '保存日志失败' })
  }
})

// GET /api/snapshots — 获取快照列表
app.get('/api/snapshots', requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      return res.json([])
    }
    const dirs = fs.readdirSync(SNAPSHOTS_DIR)
      .filter(d => fs.statSync(path.join(SNAPSHOTS_DIR, d)).isDirectory())
      .sort((a, b) => b.localeCompare(a)) // 最新的在前
    
    const snapshots = dirs.map(dir => {
      const metaFile = path.join(SNAPSHOTS_DIR, dir, 'meta.json')
      let meta = { name: dir, createdAt: 0, createdBy: '' }
      if (fs.existsSync(metaFile)) {
        try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) } catch {}
      }
      return { id: dir, ...meta }
    })
    
    res.json(snapshots)
  } catch (e) {
    res.status(500).json({ error: '获取快照列表失败' })
  }
})

// POST /api/snapshots — 创建快照
app.post('/api/snapshots', requireAuth, (req, res) => {
  try {
    const { name } = req.body
    const now = new Date()
    const id = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`
    
    const snapshotDir = path.join(SNAPSHOTS_DIR, id, 'data')
    fs.mkdirSync(snapshotDir, { recursive: true })
    
    // 复制所有数据文件
    const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    for (const file of dataFiles) {
      fs.copyFileSync(path.join(DATA_DIR, file), path.join(snapshotDir, file))
    }
    
    // 写入元数据
    const meta = {
      name: name || `快照 ${id}`,
      createdAt: Date.now(),
      createdBy: req.session.user.username
    }
    fs.writeFileSync(path.join(SNAPSHOTS_DIR, id, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
    
    res.json({ success: true, id, ...meta })
  } catch (e) {
    console.error('创建快照失败:', e)
    res.status(500).json({ error: '创建快照失败' })
  }
})

// POST /api/snapshots/:id/restore — 恢复快照
app.post('/api/snapshots/:id/restore', requireAuth, (req, res) => {
  try {
    const { id } = req.params
    const snapshotDataDir = path.join(SNAPSHOTS_DIR, id, 'data')
    
    if (!fs.existsSync(snapshotDataDir)) {
      return res.status(404).json({ error: '快照不存在' })
    }

    const now = new Date()
    const backupId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}-before-restore`
    const backupDataDir = path.join(SNAPSHOTS_DIR, backupId, 'data')
    fs.mkdirSync(backupDataDir, { recursive: true })
    const currentDataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    for (const file of currentDataFiles) {
      fs.copyFileSync(path.join(DATA_DIR, file), path.join(backupDataDir, file))
    }
    const backupMeta = {
      name: `恢复快照前自动备份：${id}`,
      createdAt: Date.now(),
      createdBy: req.session.user.username,
      type: 'before-restore',
      restoreTarget: id
    }
    fs.writeFileSync(path.join(SNAPSHOTS_DIR, backupId, 'meta.json'), JSON.stringify(backupMeta, null, 2), 'utf-8')
    
    // 复制快照数据文件到 data 目录
    const files = fs.readdirSync(snapshotDataDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      fs.copyFileSync(path.join(snapshotDataDir, file), path.join(DATA_DIR, file))
    }
    
    // 递增所有版本号，强制客户端重新拉取
    for (const key of VALID_KEYS) {
      dataVersions[key] = (dataVersions[key] || 0) + 1
    }
    
    res.json({ success: true, restoredFiles: files.length })
  } catch (e) {
    console.error('恢复快照失败:', e)
    res.status(500).json({ error: '恢复快照失败' })
  }
})

// DELETE /api/snapshots/:id — 删除快照
app.delete('/api/snapshots/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params
    const snapshotDir = path.join(SNAPSHOTS_DIR, id)
    if (!fs.existsSync(snapshotDir)) {
      return res.status(404).json({ error: '快照不存在' })
    }
    // 递归删除目录
    fs.rmSync(snapshotDir, { recursive: true, force: true })
    res.json({ success: true, id })
  } catch (e) {
    res.status(500).json({ error: '删除快照失败' })
  }
})

// API: 获取数据（需要认证）
app.get('/api/data/:key', requireAuth, (req, res) => {
  const { key } = req.params
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ success: false, message: '无效的数据键' })
  }
  const data = readData(key)
  res.json({ success: true, data })
})

// API: 保存数据（需要认证）
app.post('/api/data/:key', requireAuth, (req, res) => {
  const { key } = req.params
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ success: false, message: '无效的数据键' })
  }
  const data = req.body
  const success = writeData(key, data)
  if (success) {
    // 递增版本号
    dataVersions[key] = (dataVersions[key] || 0) + 1
    res.json({ success: true, message: '保存成功' })
  } else {
    res.status(500).json({ success: false, message: '保存失败' })
  }
})

// API: 获取所有数据（批量，需要认证）
app.get('/api/data', requireAuth, (req, res) => {
  const result = {}
  for (const key of ALLOWED_KEYS) {
    result[key] = readData(key)
  }
  res.json({ success: true, data: result })
})

// API: 保存所有数据（批量，需要认证）
app.post('/api/data', requireAuth, (req, res) => {
  const data = req.body
  let allSuccess = true
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_KEYS.has(key)) {
      if (!writeData(key, value)) {
        allSuccess = false
      }
    }
  }
  res.json({ success: allSuccess, message: allSuccess ? '全部保存成功' : '部分保存失败' })
})

// ============================================================
// 提示词参考文件同步 API
// ============================================================

const REFS_DIR = path.join(__dirname, 'src', 'services', 'prompts', 'references')
const VALID_REALMS = ['upper', 'mortal', 'abyss']
const VALID_FIELDS = ['past', 'present', 'future']
const PHASE2_CONTINENT_IDS = ['jin', 'mu', 'bing', 'huo', 'tu', 'feng', 'lei', 'guang', 'an']
const PHASE2_SYNC_FIELDS = ['mainPlot', 'coreConflict', 'playerGoal']
const PHASE3_CONTINENT_IDS = ['jin', 'bing', 'huo']
const PHASE3_SYNC_SECTIONS = ['entryPrompt', 'completionFeedback', 'bosses', 'levelNodes']

// 模块配置表：定义 realm 之外的同步目标
const MODULE_CONFIGS = {
  storyline: {
    fileName: 'storyline-chapter1-refs.ts',
    varName: 'STORYLINE_CHAPTER1_REFERENCES',
    validFields: [
      'overview',
      'chapter1Goal', 'chapter1Events', 'chapter1Resolution',
      'chapter2Goal', 'chapter2Events', 'chapter2Resolution',
      'chapter3Goal', 'chapter3Events', 'chapter3Resolution',
    ],
    header: `/**
 * 主线前三章参考文档
 * 用途: 作为 main-storyline 子模块的参考素材注入 prompt
 */
`,
  },
  overview: {
    fileName: 'overview-refs.ts',
    varName: 'OVERVIEW_REFERENCES',
    validFields: ['content'],
    header: `/**
 * 三界整体概述参考文档
 * 来源: docx/三界整体概述.txt / 三界整体概述.md
 * 用途: 作为 realm-overview 子模块的参考素材注入 prompt
 */
`,
  },
  playerIdentity: {
    fileName: 'player-identity-refs.ts',
    varName: 'PLAYER_IDENTITY_REFERENCES',
    validFields: ['origin', 'initialPerception', 'revelationArc'],
    header: `/**
 * 玩家身份参考文档
 * 来源: data/world.json 中已审阅的 playerIdentity 文稿
 * 用途: 作为 player-identity 子模块的参考素材注入 prompt
 */
`,
  },
  heroSystem: {
    fileName: 'hero-system-refs.ts',
    varName: 'HERO_SYSTEM_REFERENCES',
    validFields: ['content'],
    header: `/**
 * 英雄系统参考文档
 * 来源: data/world.json 中已审阅的 heroSystem 文稿
 * 用途: 作为 hero-system 与英雄背景子模块的参考素材注入 prompt
 */
`,
  },
  castleGoddess: {
    fileName: 'castle-goddess-refs.ts',
    varName: 'CASTLE_GODDESS_REFERENCES',
    validFields: ['castleDescription', 'castleSignificance', 'goddessName', 'goddessAppearance', 'goddessPersonality'],
    header: `/**
 * 城堡与女神参考文档
 * 来源: data/world.json 中已审阅的 castleGoddess 可见字段
 * 用途: 作为 castle-goddess 子模块的参考素材注入 prompt
 */
`,
  },
  worldTree: {
    fileName: 'world-tree-system-refs.ts',
    varName: 'WORLD_TREE_SYSTEM_REFERENCES',
    validFields: ['growthMechanism', 'resourceContribution', 'unlockedFeatures', 'fourthForce', 'runeConnection'],
    header: `/**
 * 世界树系统参考文档
 * 来源: data/world.json 中已审阅的 worldTreeSystem 文稿
 * 用途: 作为 world-tree-system 子模块的参考素材注入 prompt
 */
`,
  },
  openingBattle: {
    fileName: 'opening-battle-refs.ts',
    varName: 'OPENING_BATTLE_REFERENCES',
    validFields: ['sealAbyss'],
    header: `/**
 * 开场大战参考文档
 * 来源: data/world.json 中已审阅的 openingBattle 文稿
 * 用途: 作为 opening-battle 子模块的参考素材注入 prompt
 */
`,
  },
  phase2Continents: {
    fileName: 'phase2-continent-refs.ts',
    varName: 'PHASE2_CONTINENT_REFERENCES',
    validFields: PHASE2_CONTINENT_IDS.flatMap(id => PHASE2_SYNC_FIELDS.map(field => `${id}_${field}`)),
    header: `/**
 * 阶段二九大陆参考文档
 * 来源: data/continents.json 中已审阅的大陆叙事文稿
 * 用途: 作为 phase2 动态大陆子模块的参考素材注入 prompt
 */
`,
  },
  phase3Landing: {
    fileName: 'phase3-landing-refs.ts',
    varName: 'PHASE3_LANDING_REFERENCES',
    validFields: PHASE3_CONTINENT_IDS.flatMap(id => PHASE3_SYNC_SECTIONS.map(section => `${id}_${section}`)),
    header: `/**
 * 阶段三落地剧情参考文档
 * 来源: data/landing.json 中已审阅的前三大陆落地文稿
 * 用途: 作为 phase3 动态落地子模块的参考素材注入 prompt
 */
`,
  },
}

function realmVarName(realm) {
  if (realm === 'upper') return 'UPPER_REALM_REFERENCES'
  if (realm === 'mortal') return 'MORTAL_REALM_REFERENCES'
  return 'ABYSS_REALM_REFERENCES'
}

function realmFilePath(realm) {
  return path.join(REFS_DIR, `${realm}-realm-refs.ts`)
}

// 根据 realm 生成与 MODULE_CONFIGS 同结构的配置
function realmConfig(realm) {
  const realmLabel = realm === 'upper' ? '上界·神殿'
    : realm === 'mortal' ? '凡界'
    : '深渊·根域'
  return {
    filePath: realmFilePath(realm),
    varName: realmVarName(realm),
    validFields: VALID_FIELDS,
    header: `/**
 * ${realmLabel}参考文档
 * 来源: data/world.json 中已审阅的 realmStructure.${realm} 文稿
 * 用途: 作为 realm-${realm} 子模块的参考素材注入 prompt
 */
`,
  }
}

// 根据 module 名取得配置（含完整 filePath）
function moduleConfig(moduleName) {
  const cfg = MODULE_CONFIGS[moduleName]
  if (!cfg) return null
  return {
    filePath: path.join(REFS_DIR, cfg.fileName),
    varName: cfg.varName,
    validFields: cfg.validFields,
    header: cfg.header,
  }
}

// 转义模板字符串内容
function escapeTemplateString(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

// 解析现有 .ts 文件中指定字段列表的内容（按字段名匹配反引号包裹的模板字符串）
function parseExistingRefsFile(content, validFields = VALID_FIELDS) {
  const result = {}
  for (const field of validFields) {
    result[field] = ''
    const regex = new RegExp(`${field}:\\s*\`([\\s\\S]*?)(?<!\\\\)\``)
    const match = content.match(regex)
    if (match) {
      result[field] = match[1]
        .replace(/\\`/g, '`')
        .replace(/\\\$\{/g, '${')
        .replace(/\\\\/g, '\\')
    }
  }
  return result
}

// 生成完整的 .ts 文件内容（通用版本）
function generateRefsFile({ varName, validFields, header, fields }) {
  const body = validFields
    .map(f => `  ${f}: \`${escapeTemplateString(fields[f] || '')}\`,`)
    .join('\n')
  return `${header}export const ${varName} = {\n${body}\n}\n`
}

// 从请求体解析同步目标：返回 { mode, config } 或 { error }
function resolveSyncTarget(body) {
  const hasRealm = body && typeof body.realm !== 'undefined'
  const hasModule = body && typeof body.module !== 'undefined'
  if (hasRealm && hasModule) {
    return { error: 'realm 与 module 不能同时提供' }
  }
  if (!hasRealm && !hasModule) {
    return { error: '必须提供 realm 或 module 参数之一' }
  }
  if (hasRealm) {
    if (!VALID_REALMS.includes(body.realm)) {
      return { error: `无效的 realm，必须是 ${VALID_REALMS.join('/')}` }
    }
    return { mode: 'realm', label: body.realm, config: realmConfig(body.realm) }
  }
  const cfg = moduleConfig(body.module)
  if (!cfg) {
    return { error: `无效的 module，必须是 ${Object.keys(MODULE_CONFIGS).join('/')}` }
  }
  return { mode: 'module', label: body.module, config: cfg }
}

// POST /api/sync-reference — 单字段同步（支持 realm 与 module 两种模式）
app.post('/api/sync-reference', requireAuth, (req, res) => {
  try {
    const target = resolveSyncTarget(req.body)
    if (target.error) {
      return res.status(400).json({ success: false, message: target.error })
    }
    const { config, label } = target
    const { field, content } = req.body || {}
    if (!config.validFields.includes(field)) {
      return res.status(400).json({ success: false, message: `无效的 field，必须是 ${config.validFields.join('/')}` })
    }
    if (typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'content 必须为非空字符串' })
    }

    const { filePath } = config
    let existingFields = {}
    for (const f of config.validFields) existingFields[f] = ''
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        existingFields = { ...existingFields, ...parseExistingRefsFile(raw, config.validFields) }
      } catch (e) {
        console.error(`[sync-reference] 读取现有文件失败: ${filePath}`, e)
        return res.status(500).json({ success: false, message: '读取现有参考文件失败' })
      }
    }

    existingFields[field] = content
    const output = generateRefsFile({
      varName: config.varName,
      validFields: config.validFields,
      header: config.header,
      fields: existingFields,
    })

    try {
      fs.writeFileSync(filePath, output, 'utf-8')
    } catch (e) {
      console.error(`[sync-reference] 写入文件失败: ${filePath}`, e)
      return res.status(500).json({ success: false, message: '写入参考文件失败' })
    }

    console.log(`[sync-reference] 已同步 ${label}.${field}`)
    res.json({ success: true })
  } catch (e) {
    console.error('[sync-reference] 未知错误:', e)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// POST /api/sync-reference/batch — 批量同步（支持 realm 与 module 两种模式）
app.post('/api/sync-reference/batch', requireAuth, (req, res) => {
  try {
    const target = resolveSyncTarget(req.body)
    if (target.error) {
      return res.status(400).json({ success: false, message: target.error })
    }
    const { config, label } = target
    const { fields } = req.body || {}
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ success: false, message: 'fields 必须是对象' })
    }

    const { filePath } = config
    let existingFields = {}
    for (const f of config.validFields) existingFields[f] = ''
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        existingFields = { ...existingFields, ...parseExistingRefsFile(raw, config.validFields) }
      } catch (e) {
        console.error(`[sync-reference/batch] 读取现有文件失败: ${filePath}`, e)
        return res.status(500).json({ success: false, message: '读取现有参考文件失败' })
      }
    }

    const updated = []
    for (const field of config.validFields) {
      if (Object.prototype.hasOwnProperty.call(fields, field)) {
        const value = fields[field]
        if (typeof value !== 'string' || value.trim() === '') {
          return res.status(400).json({ success: false, message: `字段 ${field} 必须为非空字符串` })
        }
        existingFields[field] = value
        updated.push(field)
      }
    }

    if (updated.length === 0) {
      return res.status(400).json({
        success: false,
        message: `fields 中至少需要包含一个有效字段 (${config.validFields.join('/')})`,
      })
    }

    const output = generateRefsFile({
      varName: config.varName,
      validFields: config.validFields,
      header: config.header,
      fields: existingFields,
    })

    try {
      fs.writeFileSync(filePath, output, 'utf-8')
    } catch (e) {
      console.error(`[sync-reference/batch] 写入文件失败: ${filePath}`, e)
      return res.status(500).json({ success: false, message: '写入参考文件失败' })
    }

    console.log(`[sync-reference/batch] 已同步 ${label}: ${updated.join(', ')}`)
    res.json({ success: true, updated })
  } catch (e) {
    console.error('[sync-reference/batch] 未知错误:', e)
    res.status(500).json({ success: false, message: '服务器内部错误' })
  }
})

// PPT 生成路由
registerPptRoutes(app, requireAuth)

// docx 目录静态访问（包含 PPT 文件）
app.use('/docx', express.static(path.join(__dirname, 'docx')))

// 托管前端构建产物
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - 所有非 API 请求返回 index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const server = http.createServer(app)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`世界观编辑器后端服务运行中: http://0.0.0.0:${PORT}`)
})
