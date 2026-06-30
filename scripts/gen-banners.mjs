#!/usr/bin/env node
/**
 * gen-banners.mjs —— 为五个主视图生成史诗油画风 Banner
 *
 * 使用方式：
 *   cd demogame_yong
 *   node scripts/gen-banners.mjs
 *
 * 输出：public/images/banners/{phase1,phase2,phase3,opinions,gallery}.png
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'images', 'banners')

const API_KEY = process.env.BANNER_API_KEY?.trim()
const BASE_URL = process.env.BANNER_BASE_URL?.replace(/\/+$/, '')
const MODEL = process.env.BANNER_MODEL?.trim() || 'gpt-image-2'
const SIZE = '1792x1024'  // 宽屏电影比例，适合 banner

/**
 * 五张 banner 的 prompt 配置。
 * 每条 prompt 均为英文，强调：写实油画 / 电影级灯光 / 西方魔幻史诗 / 无文字。
 */
const PROMPTS = [
  {
    key: 'phase1',
    title: '世界框架与核心叙事 · 三界起源',
    prompt:
      'An epic cinematic oil painting of the cosmic World Tree Yggdrasil rising from an abyssal root network, its colossal trunk piercing storm-clouds into a radiant celestial temple above, luminous golden sap flowing along the bark, three realms visible (dark abyss roots below, misty mortal mainland in the middle, floating crystalline heavenly temple above), hanging ruins and floating rock islands, dramatic god-rays bursting through clouds, distant mountain ranges silhouetted in purple twilight, embers and golden motes drifting through air, baroque master painter style, reminiscent of John Martin and Caspar David Friedrich, ultra-detailed, rich oil impasto texture, warm amber and deep indigo palette, no text, no characters, ultrawide composition'
  },
  {
    key: 'phase2',
    title: '九大陆叙事设计',
    prompt:
      'A serene sweeping cinematic oil painting of nine floating continents suspended peacefully in a vast cloudy twilight sky, each island showcasing a distinct natural biome — a golden forested plateau with gilded autumn leaves, a lush verdant rainforest with waterfalls cascading off the cliff edges, snow-capped frozen peaks with glacial blue ice, a vast rolling desert dune mesa, a crystalline lavender flower field, swirling soft wind currents carrying petals, a high mountain temple shrouded in mist, a blossoming cherry-tree garden isle, a calm starlit observatory peak — soft glowing ribbons of aurora light weaving between them, dramatic golden-hour sunset lighting, painterly impressionist clouds, distant mythical scale, tranquil epic fantasy matte painting style, no characters, no text, ultrawide cinematic composition, rich painterly brushstrokes, warm amber highlights against deep twilight purple shadows',
  },
  {
    key: 'phase3',
    title: '前三大陆落地剧情 · 金 / 冰 / 火',
    prompt:
      'A panoramic serene fantasy oil painting depicting the peaceful convergence of three natural realms — on the left a vast golden wheat-field plateau with glowing sunlit grass and a distant cathedral of polished marble and gilded domes, in the middle a frozen tundra with soft snowdrifts and jagged crystalline blue-white ice towers glistening beneath an aurora, on the right a majestic volcanic highland with glowing orange rivers of molten rock flowing safely around stone cliffs, smoldering embers drifting gently, all joined by a soft luminous rainbow arc of magical energy across the sky, distant elegant castle spires on far horizons, ash petals and snowflakes drifting together in the air, sky split between auroral teal, holy gold dawn, and warm ember orange, volumetric god-rays piercing soft clouds, Baroque painterly chiaroscuro lighting, tranquil heroic cinematic composition, oil impasto painterly texture, no people, no characters, no figures, no weapons, no blood, no text, ultrawide 16:9 composition, masterful matte painting style',
  },
  {
    key: 'opinions',
    title: '甲方意见 · 议事庭',
    prompt:
      'A moody cinematic oil painting of an ancient candlelit royal council hall at night, a massive oak round table strewn with unfurled parchment scrolls, a glowing wax seal being pressed by an unseen hand, quill pens and ink wells, ornate bronze candelabras with dripping candles casting warm pools of light, tall gothic arched stained-glass windows behind, tapestries with gold thread, dust motes suspended in golden beams, a heavy leatherbound codex open in the foreground, deep amber and oxblood red shadow palette, chiaroscuro Rembrandt lighting, textured old oil painting with cracked varnish feel, no people visible, no text, ultrawide cinematic composition',
  },
  {
    key: 'gallery',
    title: '素材库 · 画师工坊',
    prompt:
      'An atmospheric cinematic oil painting of a grand arcane atelier and gallery — towering marble hall with dozens of gilded baroque picture frames hung on crimson velvet walls, half-finished painted canvases on wooden easels, stacks of old leatherbound sketchbooks, scattered brushes and pigment jars, bronze sculpted busts on pedestals, enchanted floating runes circling around an obsidian altar in the center, ornate chandeliers with flickering candles, stained glass rose windows throwing colored light across polished marble floor, warm amber and rich teal palette, dust and golden sparkles in volumetric god-rays, Renaissance museum cathedral aesthetic, painterly oil texture, no characters visible, no text, ultrawide cinematic composition, masterful chiaroscuro lighting',
  },
]

async function generateOne({ key, title, prompt }) {
  console.log(`\n[${key}] ${title}`)
  console.log(`  prompt: ${prompt.slice(0, 80)}...`)
  const url = `${BASE_URL}/images/generations`
  const body = {
    model: MODEL,
    prompt,
    n: 1,
    size: SIZE,
  }
  const t0 = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 500)}`)
  }
  const json = await res.json()
  const item = json?.data?.[0]
  if (!item) throw new Error(`unexpected response: ${JSON.stringify(json).slice(0, 500)}`)

  // 接口可能返回 url 或 b64_json
  let buffer
  if (item.url) {
    const imgRes = await fetch(item.url)
    buffer = Buffer.from(await imgRes.arrayBuffer())
  } else if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64')
  } else {
    throw new Error(`no url/b64_json in: ${JSON.stringify(item).slice(0, 200)}`)
  }

  const outPath = path.join(OUT_DIR, `${key}.png`)
  fs.writeFileSync(outPath, buffer)
  console.log(`  ✓ saved -> ${path.relative(ROOT, outPath)}  (${(buffer.length / 1024).toFixed(1)} KB, ${Date.now() - t0}ms)`)
  return outPath
}

async function main() {
  if (!API_KEY || !BASE_URL) {
    console.error('BANNER_API_KEY and BANNER_BASE_URL are required.')
    process.exit(1)
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const only = process.argv[2] // 可选：指定 key 只跑一张
  const jobs = only ? PROMPTS.filter(p => p.key === only) : PROMPTS
  if (jobs.length === 0) {
    console.error(`no matching prompt for key="${only}"`)
    process.exit(1)
  }
  console.log(`▶ generating ${jobs.length} banner(s) via ${MODEL}`)
  console.log(`  out dir: ${OUT_DIR}`)
  let ok = 0
  let fail = 0
  for (const job of jobs) {
    try {
      await generateOne(job)
      ok++
    } catch (e) {
      fail++
      console.error(`  ✗ FAIL [${job.key}]:`, e.message)
    }
  }
  console.log(`\n▶ done. success=${ok}  fail=${fail}`)
  if (fail > 0) process.exit(2)
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
