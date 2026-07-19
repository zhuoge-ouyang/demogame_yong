import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTINENT_IDS = ['jin', 'mu', 'bing', 'huo']
const SECTION_IDS = ['systemDialogue', 'bosses', 'levelNodes']

function formatSystemDialogue(continent) {
  return [
    `【开场对白】\n${continent.systemDialogue.opening || ''}`,
    ...continent.systemDialogue.actNodes.map((dialogue, index) => `【第${index + 1}幕节点】\n${dialogue || ''}`)
  ].join('\n\n')
}

function formatBosses(continent) {
  return continent.bosses.map((boss, index) => [
    `【Boss${index + 1}·第${boss.areaIndex}区域】`,
    `名字：${boss.name || ''}`,
    `身份：${boss.identity || ''}`,
    `动机：${boss.motivation || ''}`,
    `一句话台词：${boss.signatureLine || ''}`
  ].join('\n')).join('\n\n')
}

function formatLevelNodes(continent) {
  return continent.levelNodes.map((node, index) => {
    const lines = [
      `【区域${index + 1}】`,
      `名称：${node.name || ''}`,
      `叙事任务：${node.storyPurpose || ''}`,
      `区域故事：${node.storyContent || ''}`,
      `进入前提示：${node.entryPrompt || ''}`,
      `结束后反馈：${node.completionFeedback || ''}`,
      `叙事线索：${node.narrativeReward || ''}`
    ]
    if ((index + 1) % 3 !== 0) {
      lines.push(
        `区域对手名字：${node.opponent?.name || ''}`,
        `区域对手身份：${node.opponent?.identity || ''}`,
        `区域对手动机：${node.opponent?.motivation || ''}`,
        `区域对手台词：${node.opponent?.signatureLine || ''}`
      )
    }
    return lines.join('\n')
  }).join('\n\n')
}

function escapeTemplateString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

const landingPath = path.join(ROOT_DIR, 'data', 'landing.json')
const outputPath = path.join(ROOT_DIR, 'src', 'services', 'prompts', 'references', 'phase3-landing-refs.ts')
const landing = JSON.parse(fs.readFileSync(landingPath, 'utf8'))
const formatters = { systemDialogue: formatSystemDialogue, bosses: formatBosses, levelNodes: formatLevelNodes }
const fields = {}

for (const continentId of CONTINENT_IDS) {
  for (const sectionId of SECTION_IDS) {
    fields[`${continentId}_${sectionId}`] = formatters[sectionId](landing[continentId])
  }
}

const body = Object.entries(fields)
  .map(([key, value]) => `  ${key}: \`${escapeTemplateString(value)}\`,`)
  .join('\n')
const output = `/**
 * 阶段三落地剧情参考文档
 * 来源: data/landing.json 中已审阅的四大陆落地文稿
 * 用途: 作为 phase3 动态落地子模块的参考素材注入 prompt
 */
export const PHASE3_LANDING_REFERENCES = {
${body}
}
`

fs.writeFileSync(outputPath, output, 'utf8')
console.log('Synced Phase3 references from data/landing.json')
