import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_PATH = path.join(ROOT, 'data', 'landing.json')
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'phase3')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'manifest.json')
const CONTINENTS = ['mu', 'bing', 'huo']

const visualBibles = {
  mu: {
    name: 'Verdant Forest continent',
    palette: 'deep emerald, moss green, restrained amber, bone white, charcoal shadow',
    world: 'ancient world-tree roots, living timber sanctuaries, wet stone, pale fungi, root bridges, grounded medieval forest craft'
  },
  bing: {
    name: 'Frost continent',
    palette: 'glacial blue, silver, pale cyan, muted gold, near-black ice shadow',
    world: 'frozen gothic settlements, wind-carved ice, ancient thermal root channels, frostbound fortifications, aurora haze'
  },
  huo: {
    name: 'Infernal continent',
    palette: 'obsidian black, furnace red, ember orange, white-gold fire, cold steel accents',
    world: 'volcanic forges, basalt citadels, ash plains, molten root channels, monumental medieval furnace architecture'
  }
}

function regionPrompt(continentId, region, index) {
  const bible = visualBibles[continentId]
  return [
    'Use case: stylized concept art',
    'Asset type: cinematic region key art for a Western dark-fantasy worldbuilding website',
    `Region: ${region.name}, region ${index + 1} of the ${bible.name}`,
    `Narrative facts: ${region.storyContent}`,
    `Scene language: ${bible.world}`,
    'Style/medium: prestige Western dark fantasy film keyframe, painterly photorealism, grounded materials, large-scale environmental concept art, subtle oil-paint texture',
    'Composition/framing: cinematic widescreen establishing shot, one clear focal path, strong foreground-midground-background separation, characters remain small enough that the location is the subject',
    `Color palette: ${bible.palette}`,
    'Continuity: original setting, solemn mythic tone, believable ecology and architecture, no modern technology',
    'Constraints: depict only this story beat; no readable text, no letters, no logos, no UI, no watermark, no decorative border, no split panels, no collage'
  ].join('\n')
}

function bossPrompt(continentId, boss) {
  const bible = visualBibles[continentId]
  return [
    'Use case: stylized character concept art',
    'Asset type: final Boss key art for a Western dark-fantasy worldbuilding website',
    `Boss: ${boss.name}`,
    `Identity and narrative relationship: ${boss.identity}`,
    `Core motivation: ${boss.motivation}`,
    `Visual world: ${bible.world}`,
    'Style/medium: prestige Western dark fantasy character concept painting, painterly photorealism, grounded medieval armor and materials, highly resolved face and silhouette, subtle oil-paint texture',
    'Composition/framing: vertical 4:5 full-body hero framing, single character, readable silhouette, restrained atmospheric environment from their act, no character sheet panels',
    `Color palette: ${bible.palette}`,
    'Character direction: threatening but narratively tragic, visual details must express identity and motivation rather than generic evil',
    'Constraints: one original character only; no readable text, no labels, no logos, no UI, no watermark, no decorative border, no split panels, no collage, no franchise resemblance'
  ].join('\n')
}

const landing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
const assets = []

for (const continentId of CONTINENTS) {
  const continent = landing[continentId]
  fs.mkdirSync(path.join(OUTPUT_DIR, continentId), { recursive: true })
  continent.levelNodes.forEach((region, index) => {
    assets.push({
      id: `${continentId}-region-${String(index + 1).padStart(2, '0')}`,
      type: 'region',
      continentId,
      regionIndex: index + 1,
      title: region.name,
      output: `/images/phase3/${continentId}/region-${String(index + 1).padStart(2, '0')}.png`,
      prompt: regionPrompt(continentId, region, index)
    })
  })
  continent.bosses.forEach((boss, index) => {
    assets.push({
      id: `${continentId}-boss-${String(index + 1).padStart(2, '0')}`,
      type: 'boss',
      continentId,
      act: index + 1,
      title: boss.name,
      output: `/images/phase3/${continentId}/boss-${String(index + 1).padStart(2, '0')}.png`,
      prompt: bossPrompt(continentId, boss)
    })
  })
}

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({ model: 'gpt-image-2', assets }, null, 2)}\n`, 'utf8')
console.log(`Wrote ${assets.length} Image 2 prompts to ${path.relative(ROOT, OUTPUT_PATH)}`)
