import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '50mb' }))

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

// API: 获取数据
app.get('/api/data/:key', (req, res) => {
  const { key } = req.params
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ success: false, message: '无效的数据键' })
  }
  const data = readData(key)
  res.json({ success: true, data })
})

// API: 保存数据
app.post('/api/data/:key', (req, res) => {
  const { key } = req.params
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ success: false, message: '无效的数据键' })
  }
  const data = req.body
  const success = writeData(key, data)
  if (success) {
    res.json({ success: true, message: '保存成功' })
  } else {
    res.status(500).json({ success: false, message: '保存失败' })
  }
})

// API: 获取所有数据（批量）
app.get('/api/data', (req, res) => {
  const result = {}
  for (const key of ALLOWED_KEYS) {
    result[key] = readData(key)
  }
  res.json({ success: true, data: result })
})

// API: 保存所有数据（批量）
app.post('/api/data', (req, res) => {
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

// 静态文件服务（生产模式）
app.use(express.static(path.join(__dirname, 'dist')))
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`世界观编辑器后端服务运行中: http://localhost:${PORT}`)
})
