import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const continentIds = ['jin', 'bing', 'huo']
const dataFiles = ['landing.json', 'landing-avatar.json']

function migrateContinent(source = {}) {
  const legacyEntry = source.entryPrompt || {}
  const sourceDialogue = source.systemDialogue || {}
  const actNodes = Array.isArray(sourceDialogue.actNodes)
    ? sourceDialogue.actNodes.slice(0, 3)
    : []
  while (actNodes.length < 3) actNodes.push('')

  const sourceBosses = Array.isArray(source.bosses) ? source.bosses : []
  const bosses = [1, 2, 3].map((act, index) => {
    const boss = sourceBosses[index] || {}
    return {
      name: boss.name || '',
      identity: boss.identity || '',
      motivation: boss.motivation || '',
      signatureLine: boss.signatureLine || '',
      act,
      areaIndex: act * 3
    }
  })

  const sourceNodes = Array.isArray(source.levelNodes) ? source.levelNodes : []
  const levelNodes = Array.from({ length: 9 }, (_, index) => {
    const node = sourceNodes[index] || {}
    return {
      name: node.name || `区域${index + 1}`,
      act: Math.floor(index / 3) + 1,
      storyPurpose: node.storyPurpose || node.storyBeat || '',
      entryPrompt: node.entryPrompt || '',
      completionFeedback: node.completionFeedback || '',
      narrativeReward: node.narrativeReward || '',
      gameplayHandoff: node.gameplayHandoff || node.keyEncounter || ''
    }
  })

  return {
    systemDialogue: {
      opening: sourceDialogue.opening || legacyEntry.npcDialogue || legacyEntry.narrative || '',
      actNodes
    },
    bosses,
    levelNodes,
    _meta: source._meta || {}
  }
}

for (const fileName of dataFiles) {
  const filePath = path.join(rootDir, 'data', fileName)
  if (!fs.existsSync(filePath)) continue

  const source = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const migrated = Object.fromEntries(
    continentIds.map(id => [id, migrateContinent(source[id])])
  )
  fs.writeFileSync(filePath, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8')
  console.log(`Migrated ${fileName}`)
}
