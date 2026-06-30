import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { findCanonViolations } from './canon-audit.mjs'

const legacyFireBirdTerms = [
  '\u706b\u51e4\u51f0',
  '\u51e4\u51f0',
  String.fromCharCode(70, 105, 114, 101, 32, 80, 104, 111, 101, 110, 105, 120),
  String.fromCharCode(102, 105, 114, 101, 32, 112, 104, 111, 101, 110, 105, 120),
  String.fromCharCode(80, 104, 111, 101, 110, 105, 120),
  String.fromCharCode(112, 104, 111, 101, 110, 105, 120)
]

const rootSpeakerTerm = '\u6839\u8bed\u8005'
const rootSpeakerFullName = `${rootSpeakerTerm}\uff08The Root Speaker\uff09`
const legacyForestSpeakerTerm = '\u68ee\u8bed\u8005'
const legacyForestSpeakerEnglish = String.fromCharCode(
  84, 104, 101, 32, 70, 111, 114, 101, 115, 116, 32, 83, 112, 101, 97, 107, 101, 114
)

const projectTextExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.txt',
  '.vue'
])

function collectProjectTextFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectProjectTextFiles(fullPath, files)
      continue
    }

    if (entry.isFile() && projectTextExtensions.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function collectActiveProjectTextFiles(rootDir) {
  const activeRoots = [
    'data',
    'scripts',
    'server.js',
    'src'
  ]
  const skippedRelativePaths = new Set([
    'data/history.json',
    'data/edit-logs.json'
  ])
  const files = []

  for (const entry of activeRoots) {
    const fullPath = path.join(rootDir, entry)
    if (!fs.existsSync(fullPath)) continue

    const stat = fs.statSync(fullPath)
    if (stat.isFile()) {
      files.push(fullPath)
      continue
    }

    for (const file of collectProjectTextFiles(fullPath)) {
      const relativePath = path.relative(rootDir, file).replaceAll(path.sep, '/')
      if (!skippedRelativePaths.has(relativePath)) files.push(file)
    }
  }

  return files
}

test('project text uses the immortal-bird term instead of legacy fire-bird terms', () => {
  const rootDir = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
  const hits = []

  for (const file of collectProjectTextFiles(rootDir)) {
    const content = fs.readFileSync(file, 'utf8')
    for (const term of legacyFireBirdTerms) {
      if (content.includes(term)) {
        hits.push(`${path.relative(rootDir, file)}: ${term}`)
      }
    }
  }

  assert.deepEqual(hits, [])
})

test('findCanonViolations reports legacy canon terms with replacements', () => {
  const text = '奥雷利乌斯在圣心城废墟发现第十魂令，凯莉丝与沃卡努斯赶来。'

  const hits = findCanonViolations(text, 'fixture.txt')
  const terms = hits.map((hit) => hit.term)

  assert.deepEqual(terms, ['第十魂令', '圣心城废墟', '奥雷利乌斯', '凯莉丝', '沃卡努斯'])
  assert.ok(hits.every((hit) => hit.replacement))
})

test('findCanonViolations ignores clean current canon text', () => {
  const text = '奥里克、塞琳娜与伊格纳修斯在方舟堡根节点响应世界树种魂共鸣。'

  assert.deepEqual(findCanonViolations(text, 'fixture.txt'), [])
})

test('active phase1 player canon frames the player as Fangzhou Bastion itself', () => {
  const forbiddenActorPhrases = [
    '玩家先',
    '玩家用调和之力',
    '玩家组织',
    '玩家带',
    '玩家以调和之力',
    '玩家探索',
    '玩家不再',
    '迎接玩家'
  ]
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
  const avatar = JSON.parse(fs.readFileSync(new URL('../data/world-avatar.json', import.meta.url), 'utf8'))

  for (const [name, data] of Object.entries({ 'world.json': world, 'world-avatar.json': avatar })) {
    const storylineText = JSON.stringify(data.mainStoryline)
    for (const phrase of forbiddenActorPhrases) {
      assert.equal(
        storylineText.includes(phrase),
        false,
        `${name} mainStoryline should not describe the player as a humanoid actor: ${phrase}`
      )
    }

    const gameplayIntegration = data.playerIdentity.gameplayIntegration
    assert.equal(
      gameplayIntegration.includes('第十魂令'),
      false,
      `${name} playerIdentity.gameplayIntegration should not use legacy tenth-soul canon`
    )
    assert.match(gameplayIntegration, /方舟堡.*玩家.*本体|玩家.*方舟堡.*本身/)
  }
})

test('player identity canon fields are protected from stale local cache writes', () => {
  const protectedFields = [
    "{ moduleName: 'playerIdentity', fieldPath: 'initialPerception' }",
    "{ moduleName: 'playerIdentity', fieldPath: 'revelationArc' }",
    "{ moduleName: 'playerIdentity', fieldPath: 'gameplayIntegration' }",
    "{ moduleName: 'castleGoddess', fieldPath: 'goddess.name' }",
    "{ moduleName: 'castleGoddess', fieldPath: 'goddess.guidanceStyle' }",
    "{ moduleName: 'castleGoddess', fieldPath: 'goddess.dialogueThemes' }",
    "{ moduleName: 'castleGoddess', fieldPath: 'goddess.truthMatrix' }",
    "{ moduleName: 'heroSystem', fieldPath: 'mu.name' }",
    "{ moduleName: 'heroSystem', fieldPath: 'mu.element' }",
    "{ moduleName: 'heroSystem', fieldPath: 'mu.continent' }",
    "{ moduleName: 'heroSystem', fieldPath: 'mu.backstory' }"
  ]
  const serverSource = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8')
  const storeSource = fs.readFileSync(new URL('../src/stores/world.ts', import.meta.url), 'utf8')

  for (const field of protectedFields) {
    assert.ok(serverSource.includes(field), `server.js should protect ${field}`)
    assert.ok(storeSource.includes(field), `src/stores/world.ts should protect ${field}`)
  }
})

test('phase1 keeps castle-goddess tab while hiding selected inner fields', () => {
  const phaseConfigSource = fs.readFileSync(new URL('../src/constants/phase-config.ts', import.meta.url), 'utf8')
  const routerSource = fs.readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
  const promptOptimizerSource = fs.readFileSync(new URL('../src/services/prompt-optimizer.ts', import.meta.url), 'utf8')
  const castleGoddessSource = fs.readFileSync(new URL('../src/components/phase1/CastleGoddess.vue', import.meta.url), 'utf8')
  const batchImportSource = fs.readFileSync(new URL('../src/components/phase1/BatchImport.vue', import.meta.url), 'utf8')
  const exportImportSource = fs.readFileSync(new URL('../src/components/shared/ExportImportModal.vue', import.meta.url), 'utf8')
  const assessmentEvaluatorSource = fs.readFileSync(new URL('../src/services/assessment-evaluator.ts', import.meta.url), 'utf8')
  const aiContentParserSource = fs.readFileSync(new URL('../src/services/ai-content-parser.ts', import.meta.url), 'utf8')
  const fieldLabelsSource = fs.readFileSync(new URL('../src/constants/field-labels.ts', import.meta.url), 'utf8')
  const phase1PromptsSource = fs.readFileSync(new URL('../src/services/prompts/phase1-prompts.ts', import.meta.url), 'utf8')
  const castleGoddessPromptStart = phase1PromptsSource.indexOf('// ─── 城堡与女神')
  const worldTreePromptStart = phase1PromptsSource.indexOf("'world-tree-system'")
  assert.notEqual(castleGoddessPromptStart, -1, 'phase1 prompts should contain castle-goddess templates')
  assert.notEqual(worldTreePromptStart, -1, 'phase1 prompts should contain the next world-tree template')
  const castleGoddessPromptSource = phase1PromptsSource.slice(castleGoddessPromptStart, worldTreePromptStart)

  assert.match(phaseConfigSource, /castle-goddess/, 'phase1 should keep the castle-goddess tab')
  assert.match(phaseConfigSource, /城堡与女神设定/, 'phase1 should keep the castle-goddess label')
  assert.match(routerSource, /castle-goddess/, 'phase1 should keep the castle-goddess route')
  assert.match(promptOptimizerSource, /castle-goddess/, 'phase1 prompt optimizer should keep castle-goddess prompt access')

  const hiddenLabels = [
    '游戏中的作用',
    '真实身份',
    '引导方式',
    '对话主题',
    '言论真假策略',
    '城堡作用',
    '女神身份',
    '女神引导',
    '女神话题',
    '女神可信度',
    '言论真假'
  ]

  for (const [name, source] of Object.entries({
    'CastleGoddess.vue': castleGoddessSource,
    'BatchImport.vue': batchImportSource,
    'ExportImportModal.vue': exportImportSource,
    'assessment-evaluator.ts': assessmentEvaluatorSource,
    'ai-content-parser.ts': aiContentParserSource,
    'field-labels.ts': fieldLabelsSource,
    'phase1-prompts.ts castle-goddess templates': castleGoddessPromptSource
  })) {
    for (const term of hiddenLabels) {
      assert.equal(source.includes(term), false, `${name} should hide selected inner field: ${term}`)
    }
  }

  const hiddenFieldPaths = [
    'castle.role',
    'goddess.trueNature',
    'goddess.guidanceStyle',
    'goddess.dialogueThemes',
    'goddess.truthMatrix'
  ]
  for (const fieldPath of hiddenFieldPaths) {
    assert.equal(castleGoddessSource.includes(fieldPath), false, `CastleGoddess.vue should not bind hidden field ${fieldPath}`)
  }
})

test('content modules expose prompt-reference sync entry points', () => {
  const readProjectFile = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
  const serverSource = readProjectFile('server.js')
  const dataApiSource = readProjectFile('src/services/data-api.ts')
  const phaseConfigSource = readProjectFile('src/constants/phase-config.ts')

  assert.equal(phaseConfigSource.includes('world-tree-system'), false, 'phase1 sidebar should hide the world-tree content module tab')
  assert.match(dataApiSource, /syncModuleReferenceBatch/, 'data API should expose batch module reference sync')

  const serverModules = [
    'storyline',
    'overview',
    'playerIdentity',
    'heroSystem',
    'castleGoddess',
    'worldTree',
    'openingBattle',
    'phase2Continents',
    'phase3Landing'
  ]
  for (const moduleName of serverModules) {
    assert.match(serverSource, new RegExp(`${moduleName}: \\{`), `server.js should configure ${moduleName} reference sync`)
  }

  const componentSyncEntries = [
    { path: 'src/components/phase1/RealmStructure.vue', api: 'syncReference', target: 'overview' },
    { path: 'src/components/phase1/MainStoryline.vue', api: 'syncModuleReference', target: 'storyline' },
    { path: 'src/components/phase1/PlayerIdentity.vue', api: 'syncModuleReferenceBatch', target: 'playerIdentity' },
    { path: 'src/components/phase1/HeroSystem.vue', api: 'syncModuleReferenceBatch', target: 'heroSystem' },
    { path: 'src/components/phase1/CastleGoddess.vue', api: 'syncModuleReferenceBatch', target: 'castleGoddess' },
    { path: 'src/components/phase1/WorldTreeSystem.vue', api: 'syncModuleReferenceBatch', target: 'worldTree' },
    { path: 'src/components/phase2/ContinentDetail.vue', api: 'syncModuleReferenceBatch', target: 'phase2Continents' },
    { path: 'src/components/phase2/OpeningBattle.vue', api: 'syncModuleReferenceBatch', target: 'openingBattle' },
    { path: 'src/components/phase3/LandingDetail.vue', api: 'syncModuleReferenceBatch', target: 'phase3Landing' }
  ]
  for (const entry of componentSyncEntries) {
    const source = readProjectFile(entry.path)
    assert.match(source, /⬆同步/, `${entry.path} should expose a visible sync button`)
    assert.match(source, new RegExp(entry.api), `${entry.path} should call ${entry.api}`)
    assert.match(source, new RegExp(entry.target), `${entry.path} should sync to ${entry.target}`)
  }

  const promptReferenceEntries = [
    {
      path: 'src/services/prompts/phase1-prompts.ts',
      refs: [
        'PLAYER_IDENTITY_REFERENCES',
        'HERO_SYSTEM_REFERENCES',
        'CASTLE_GODDESS_REFERENCES',
        'WORLD_TREE_SYSTEM_REFERENCES'
      ]
    },
    { path: 'src/services/prompts/phase2-prompts.ts', refs: ['PHASE2_CONTINENT_REFERENCES'] },
    { path: 'src/services/prompts/opening-battle-prompts.ts', refs: ['OPENING_BATTLE_REFERENCES'] },
    { path: 'src/services/prompts/phase3-prompts.ts', refs: ['PHASE3_LANDING_REFERENCES'] }
  ]
  for (const entry of promptReferenceEntries) {
    const source = readProjectFile(entry.path)
    assert.match(source, /referenceDocuments/, `${entry.path} should inject synced references into prompts`)
    for (const refName of entry.refs) {
      assert.match(source, new RegExp(refName), `${entry.path} should use ${refName}`)
    }
  }
})

test('active project files use Root Speaker canon instead of the legacy forest-speaker name', () => {
  const rootDir = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
  const hits = []

  for (const file of collectActiveProjectTextFiles(rootDir)) {
    const content = fs.readFileSync(file, 'utf8')
    if (content.includes(legacyForestSpeakerTerm)) {
      hits.push(`${path.relative(rootDir, file)}: legacy CN term`)
    }
    if (content.includes(legacyForestSpeakerEnglish)) {
      hits.push(`${path.relative(rootDir, file)}: legacy EN term`)
    }
  }

  assert.deepEqual(hits, [])
})

test('finalize metadata stays symmetrical across world, continent and landing stores', () => {
  const storePaths = [
    'src/stores/world.ts',
    'src/stores/continents.ts',
    'src/stores/landing.ts'
  ]

  for (const storePath of storePaths) {
    const source = fs.readFileSync(new URL(`../${storePath}`, import.meta.url), 'utf8')
    assert.match(source, /const authStore = useAuthStore\(\)/, `${storePath} should read the active user for edit/finalize metadata`)
    assert.match(source, /finalizedBy:\s*authStore\.username/, `${storePath} should stamp finalizedBy on finalize`)
    assert.match(source, /finalizedBy\s*=\s*undefined/, `${storePath} should clear finalizedBy on unfinalize`)
    assert.match(source, /lastEditBy:\s*authStore\.username/, `${storePath} should stamp lastEditBy on edits`)
    assert.match(source, /baseContent/, `${storePath} should maintain a review baseline for diff display`)
  }
})

test('prompt builder resolves phase2 and phase3 workflow dependencies from live stores', () => {
  const source = fs.readFileSync(new URL('../src/services/prompts/index.ts', import.meta.url), 'utf8')

  assert.match(source, /resolvePromptDependencyContext/, 'prompt builder should centralize dependency resolution')
  assert.match(source, /collectPhase1SummaryContext/, 'prompt builder should resolve phase1-summary')
  assert.match(source, /collectPhase2PriorContext/, 'prompt builder should resolve phase2-{continent}-prior')
  assert.match(source, /collectPhase2AllContext/, 'prompt builder should resolve phase2-{continent}-all')
  assert.match(source, /collectPhase3ModuleContext/, 'prompt builder should resolve phase3-{continent}-{module}')
})

test('continue and expand prompts request complete replaceable drafts', () => {
  const source = fs.readFileSync(new URL('../src/services/prompts/index.ts', import.meta.url), 'utf8')

  assert.match(source, /完整可覆盖/, 'continue/expand prompts should ask for a complete draft that can replace the field')
  assert.equal(source.includes('请仅输出待续写部分的内容'), false)
  assert.equal(source.includes('输出新增部分'), false)
})

test('AI generation history is accepted only after content is actually applied', () => {
  const source = fs.readFileSync(new URL('../src/components/shared/AIPanel.vue', import.meta.url), 'utf8')

  assert.match(source, /generationHistoryId/, 'AIPanel should keep the pending history id')
  assert.match(source, /accepted:\s*false/, 'raw generation results should start as not accepted')
  assert.match(source, /markGenerationAccepted/, 'AIPanel should mark history accepted only from accept paths')
})

test('active phase1 first chapter is set on the forest continent with Root Speaker canon', () => {
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
  const avatar = JSON.parse(fs.readFileSync(new URL('../data/world-avatar.json', import.meta.url), 'utf8'))

  for (const [name, data] of Object.entries({ 'world.json': world, 'world-avatar.json': avatar })) {
    const firstChapterText = [
      data.mainStoryline.stages[0].name,
      data.mainStoryline.stages[0].goal,
      data.mainStoryline.stages[0].events,
      data.mainStoryline.stages[0].resolution
    ].join('\n')

    assert.match(firstChapterText, /翠森大陆|森元素大陆/, `${name} first chapter should happen on the forest continent`)
    assert.match(firstChapterText, new RegExp(rootSpeakerTerm), `${name} first chapter should include Root Speaker`)
    assert.equal(firstChapterText.includes(legacyForestSpeakerTerm), false, `${name} first chapter should not include the legacy forest-speaker name`)
    assert.match(firstChapterText, /根系|根脉|根须/, `${name} first chapter should frame root communication`)
    assert.match(firstChapterText, /方舟堡/, `${name} first chapter should connect Root Speaker to Fangzhou Bastion/player`)
    assert.equal(firstChapterText.includes('金耀大陆'), false, `${name} first chapter should no longer happen on Gold continent`)

    const eventPoints = data.mainStoryline.stages[0].events.match(/^\d+\./gm) || []
    const eventChars = [...data.mainStoryline.stages[0].events.replace(/\s/g, '')].length
    assert.equal(eventPoints.length, 3, `${name} first chapter should keep exactly 3 event points`)
    assert.ok(eventChars >= 300 && eventChars <= 500, `${name} first chapter events should be 300-500 chars, got ${eventChars}`)

    const firstChapterEvents = data.mainStoryline.stages[0].events.split(/\n\n+/)
    assert.match(firstChapterEvents[0], /奥里克·铸金/, `${name} first event should meet the gold hero first`)
    assert.match(firstChapterEvents[0], /第一波深渊怪物|深渊怪物/, `${name} first event should clear the first abyss monster wave`)
    assert.match(firstChapterEvents[1], /塞琳娜·霜誓/, `${name} second event should meet the ice hero`)
    assert.match(firstChapterEvents[1], /领地|巨大环境问题|环境/, `${name} second event should reveal the ice territory environmental crisis`)
    assert.match(firstChapterEvents[2], /伊格纳修斯·焚誓/, `${name} third event should meet the fire hero`)
    assert.match(firstChapterEvents[2], /不死鸟/, `${name} third event should expose the immortal-bird beast form`)
    assert.match(firstChapterEvents[2], /失去理智/, `${name} third event should show loss of reason`)
    assert.match(firstChapterEvents[2], /伤害自己|烧伤自己/, `${name} third event should show self-harm risk`)
  }
})

test('active chapter 2 and 3 preserve latest client story constraints', () => {
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
  const avatar = JSON.parse(fs.readFileSync(new URL('../data/world-avatar.json', import.meta.url), 'utf8'))

  for (const [name, data] of Object.entries({ 'world.json': world, 'world-avatar.json': avatar })) {
    const chapter2Text = [
      data.mainStoryline.stages[1].goal,
      data.mainStoryline.stages[1].events,
      data.mainStoryline.stages[1].resolution
    ].join('\n')
    const chapter3Text = [
      data.mainStoryline.stages[2].goal,
      data.mainStoryline.stages[2].events,
      data.mainStoryline.stages[2].resolution
    ].join('\n')

    assert.match(chapter2Text, /塞琳娜·霜誓/, `${name} chapter 2 should center the ice hero`)
    assert.match(chapter2Text, /巨大环境问题|领地|永冻层大片融化|冰湖倒灌/, `${name} chapter 2 should be an ice-territory environmental crisis`)
    assert.match(chapter3Text, /伊格纳修斯·焚誓/, `${name} chapter 3 should center the fire hero`)
    assert.match(chapter3Text, /人形/, `${name} chapter 3 should mention human form`)
    assert.match(chapter3Text, /兽形|不死鸟/, `${name} chapter 3 should mention beast or immortal-bird form`)
    assert.match(chapter3Text, /失去理智/, `${name} chapter 3 should include loss of reason`)
    assert.match(chapter3Text, /伤害自己|灼伤自己/, `${name} chapter 3 should include self-harm risk`)
    assert.match(chapter3Text, /身边人|盟友/, `${name} chapter 3 should include risk to people nearby`)
  }
})

test('active forest-element lord canon uses Root Speaker', () => {
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
  const avatar = JSON.parse(fs.readFileSync(new URL('../data/world-avatar.json', import.meta.url), 'utf8'))

  for (const [name, data] of Object.entries({ 'world.json': world, 'world-avatar.json': avatar })) {
    const forestLord = data.heroSystem.find((hero) => hero.id === 'mu')
    assert.ok(forestLord, `${name} should include mu/forest hero`)
    assert.equal(forestLord.name, rootSpeakerFullName)
    assert.equal(forestLord.element, '森')
    assert.equal(forestLord.continent, '翠森大陆')

    const forestLordText = [
      forestLord.visual,
      forestLord.personality,
      forestLord.backstory,
      forestLord.role,
      forestLord.joinCondition,
      forestLord.joinStage,
      forestLord.storyRole
    ].join('\n')

    assert.match(forestLordText, /根系|根脉|根须/, `${name} Root Speaker should communicate through roots`)
    assert.match(forestLordText, /方舟堡|玩家意识/, `${name} Root Speaker should communicate with Fangzhou Bastion/player`)
    assert.equal(new RegExp(`希尔凡|希尔瓦拉|${legacyForestSpeakerTerm}`).test(forestLordText), false, `${name} should not keep old forest-lord names`)
  }
})

test('active phase2 continent story fields use current hero canon', () => {
  const continents = JSON.parse(fs.readFileSync(new URL('../data/continents.json', import.meta.url), 'utf8'))
  const avatarContinents = JSON.parse(fs.readFileSync(new URL('../data/continents-avatar.json', import.meta.url), 'utf8'))

  for (const [name, data] of Object.entries({ 'continents.json': continents, 'continents-avatar.json': avatarContinents })) {
    const storyText = JSON.stringify(data)
    assert.equal(/奥雷利乌斯|凯莉丝|沃卡努斯|第十魂令/.test(storyText), false, `${name} phase2 story should not keep legacy hero or tenth-soul canon`)
    assert.match(storyText, /奥里克·铸金/, `${name} should use current gold hero canon`)
    assert.match(storyText, /塞琳娜·霜誓/, `${name} should use current ice hero canon`)
    assert.match(storyText, /伊格纳修斯·焚誓/, `${name} should use current fire hero canon`)
  }
})

test('opening battle seal-abyss draft anchors on the second soul-domain war', () => {
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
  const avatar = JSON.parse(fs.readFileSync(new URL('../data/world-avatar.json', import.meta.url), 'utf8'))

  for (const [name, data] of Object.entries({ 'world.json': world, 'world-avatar.json': avatar })) {
    const sealAbyss = data.openingBattle.sealAbyss
    assert.match(sealAbyss, /魂域第二场大战/, `${name} sealAbyss should name the second soul-domain war`)
    assert.match(sealAbyss, /众神[\s\S]*凡族|凡族[\s\S]*众神/, `${name} sealAbyss should anchor the gods and mortal tribes alliance`)
    assert.match(sealAbyss, /深渊魂族/, `${name} sealAbyss should name the abyss soul race`)
    assert.match(sealAbyss, /封印[\s\S]*深渊|深渊[\s\S]*封印/, `${name} sealAbyss should include the sealing into the abyss`)
    assert.match(sealAbyss, /三界/, `${name} sealAbyss should connect the battle to the division of the three realms`)
  }
})

test('opening battle keeps one concise gods-and-mortals version', () => {
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url), 'utf8'))
  const avatar = JSON.parse(fs.readFileSync(new URL('../data/world-avatar.json', import.meta.url), 'utf8'))
  const promptSource = fs.readFileSync(new URL('../src/services/prompts/opening-battle-prompts.ts', import.meta.url), 'utf8')

  for (const [name, data] of Object.entries({ 'world.json': world, 'world-avatar.json': avatar })) {
    assert.deepEqual(Object.keys(data.openingBattle), ['sealAbyss'], `${name} openingBattle should keep only the main sealAbyss version`)

    const sealAbyss = data.openingBattle.sealAbyss
    const compactLength = [...sealAbyss.replace(/\s/g, '')].length
    assert.ok(compactLength <= 1200, `${name} sealAbyss should be at most 1200 non-space characters, got ${compactLength}`)
    assert.match(sealAbyss, /众神联合凡族/, `${name} sealAbyss should center the gods and mortals alliance`)
    assert.match(sealAbyss, /打败|击败/, `${name} sealAbyss should state the defeat of the abyss soul race`)
    assert.match(sealAbyss, /深渊魂族/, `${name} sealAbyss should name the abyss soul race`)
    assert.match(sealAbyss, /封印/, `${name} sealAbyss should include the sealing result`)
    assert.match(sealAbyss, /三界/, `${name} sealAbyss should include the three-realm consequence`)
  }

  assert.equal(/opening-battle-endgame|opening-battle-worldtree-awakening|fieldKey:\s*'endgame'|fieldKey:\s*'worldtreeAwakening'/.test(promptSource), false)
})
