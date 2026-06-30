const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const session = require('express-session')

const app = express()
const PORT = 3001

function requireEnv(name) {
  const value = process.env[name] && process.env[name].trim()
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

// 数据版本号（内存维护，每次保存递增）
const dataVersions = {}
const VALID_KEYS = ['world', 'continents', 'landing', 'history', 'world-avatar', 'continents-avatar', 'landing-avatar', 'history-avatar']
VALID_KEYS.forEach(key => { dataVersions[key] = 0 })

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

// 写入数据
function writeData(key, data) {
  const filePath = getDataFilePath(key)
  if (!filePath) return false
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
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

// 读取意见数据
function readOpinions() {
  try {
    if (fs.existsSync(OPINIONS_FILE)) {
      return JSON.parse(fs.readFileSync(OPINIONS_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('读取意见数据失败:', e)
  }
  return {
    settings: { content: '', updatedAt: null, updatedBy: '' },
    plot: { content: '', updatedAt: null, updatedBy: '' },
    finalized: { content: '', updatedAt: null, updatedBy: '' }
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

// POST /api/opinions
app.post('/api/opinions', requireAuth, (req, res) => {
  const { module, content } = req.body
  if (!['settings', 'plot', 'finalized'].includes(module)) {
    return res.status(400).json({ error: '无效的模块名' })
  }
  const data = readOpinions()
  data[module] = {
    content: content || '',
    updatedAt: new Date().toISOString(),
    updatedBy: req.session.user.username
  }
  fs.writeFileSync(OPINIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  res.json({ success: true, data: data[module] })
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
    res.json({ success: true })
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

// 托管前端构建产物
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - 所有非 API 请求返回 index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`世界观编辑器后端服务运行中: http://0.0.0.0:${PORT}`)
})
