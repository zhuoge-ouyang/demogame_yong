import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'

import { auditPhase2Continents } from './content-audit.mjs'

const focusedAspects = JSON.parse(fs.readFileSync(new URL('../data/continents.json', import.meta.url), 'utf8')).jin.aspects

function makeContinent(aspects = focusedAspects) {
  return {
    id: 'jin',
    name: '金耀大陆',
    element: '金',
    aspects: {
      ...focusedAspects,
      ...aspects
    }
  }
}

test('auditPhase2Continents reports missing aspect as error', () => {
  const state = { jin: makeContinent({ mainPlot: '' }) }

  const report = auditPhase2Continents(state)

  assert.equal(report.errorCount, 1)
  assert.equal(report.issues[0].ruleId, 'phase2-aspect-required')
  assert.equal(report.issues[0].continentId, 'jin')
  assert.equal(report.issues[0].aspectKey, 'mainPlot')
})

test('auditPhase2Continents warns when a continent package is too thin', () => {
  const state = {
    jin: makeContinent({
      mainPlot: '玩家探索王都，击败堕落领主。',
      coreConflict: '骑士团分裂。',
      playerGoal: '收集封魂令碎片。',
      experiencePositioning: '庄重体验。',
      inGameExpression: '探索和Boss战。',
      themeExpression: '荣誉修复。',
      playerProgressionChanges: '解锁金元素防御塔。'
    })
  }

  const report = auditPhase2Continents(state)
  const thinIssue = report.issues.find(issue => issue.ruleId === 'phase2-package-depth')

  assert.equal(report.errorCount, 0)
  assert.ok(thinIssue)
  assert.equal(thinIssue?.continentId, 'jin')
})

test('auditPhase2Continents warns when a continent package is too long', () => {
  const repeated = focusedAspects.mainPlot.repeat(8)
  const state = { jin: makeContinent({ mainPlot: repeated }) }

  const report = auditPhase2Continents(state)
  const longIssue = report.issues.find(issue => issue.ruleId === 'phase2-package-too-long')

  assert.equal(report.errorCount, 0)
  assert.ok(longIssue)
  assert.equal(longIssue?.continentId, 'jin')
})

test('auditPhase2Continents warns when one field breaks package balance', () => {
  const state = { jin: makeContinent({ playerGoal: '收集碎片。' }) }

  const report = auditPhase2Continents(state)
  const balanceIssue = report.issues.find(issue => issue.ruleId === 'phase2-field-balance')

  assert.equal(report.errorCount, 0)
  assert.ok(balanceIssue)
  assert.equal(balanceIssue?.aspectKey, 'playerGoal')
})

test('auditPhase2Continents warns when package lacks client-facing anchors', () => {
  const state = {
    jin: makeContinent({
      inGameExpression: '这里主要呈现庄严、宏伟、悲伤和沉默的氛围，整体保持金色、厚重、肃穆的审美方向。',
      playerProgressionChanges: '结局表现为气氛平静，众人重新看见希望，王都的象征意义得到恢复。'
    })
  }

  const report = auditPhase2Continents(state)
  const anchorIssue = report.issues.find(issue => issue.ruleId === 'phase2-package-anchor')

  assert.equal(report.errorCount, 0)
  assert.ok(anchorIssue)
})

test('auditPhase2Continents accepts a focused continent story package', () => {
  const state = { jin: makeContinent() }

  const report = auditPhase2Continents(state)

  assert.equal(report.errorCount, 0)
  assert.equal(report.warningCount, 0)
})

test('active phase2 continents use expanded plot and three-step area pacing', () => {
  const continents = JSON.parse(fs.readFileSync(new URL('../data/continents.json', import.meta.url), 'utf8'))
  const avatarContinents = JSON.parse(fs.readFileSync(new URL('../data/continents-avatar.json', import.meta.url), 'utf8'))
  const fieldRanges = {
    mainPlot: [500, 750],
    coreConflict: [140, 340],
    playerGoal: [180, 360],
    experiencePositioning: [180, 360],
    inGameExpression: [300, 540],
    themeExpression: [150, 300],
    playerProgressionChanges: [260, 460]
  }

  for (const [sourceName, state] of Object.entries({ 'continents.json': continents, 'continents-avatar.json': avatarContinents })) {
    for (const [continentId, continent] of Object.entries(state)) {
      const aspects = continent.aspects
      const packageLength = Object.keys(fieldRanges)
        .reduce((total, aspectKey) => total + [...aspects[aspectKey].replace(/\s/g, '')].length, 0)

      assert.ok(packageLength >= 1900 && packageLength <= 2700, `${sourceName} ${continentId} package should be a complete reviewable story packet, got ${packageLength}`)
      for (const [aspectKey, [min, max]] of Object.entries(fieldRanges)) {
        const length = [...aspects[aspectKey].replace(/\s/g, '')].length
        assert.ok(length >= min && length <= max, `${sourceName} ${continentId} ${aspectKey} should be expanded, got ${length}`)
      }

      assert.match(aspects.inGameExpression, /塔防|挂机/, `${sourceName} ${continentId} inGameExpression should fit tower-defense idle presentation`)
      assert.equal(/宏大CG|大段CG|3D\s*timeline|3D时间线/i.test(aspects.inGameExpression), false, `${sourceName} ${continentId} should avoid macro CG or 3D timeline presentation`)
      assert.match(aspects.coreConflict, /区域1-3|1-3/, `${sourceName} ${continentId} coreConflict should use staged conflict pacing`)
      assert.match(aspects.playerGoal, /区域1-3|1-3/, `${sourceName} ${continentId} playerGoal should use staged goals`)
      assert.match(aspects.themeExpression, /区域1-3|1-3/, `${sourceName} ${continentId} themeExpression should tie theme to staged story`)
      assert.match(aspects.playerProgressionChanges, /区域1-3|1-3/, `${sourceName} ${continentId} progression should describe areas 1-3`)
      assert.match(aspects.playerProgressionChanges, /区域4-6|4-6/, `${sourceName} ${continentId} progression should describe areas 4-6`)
      assert.match(aspects.playerProgressionChanges, /区域7-9|7-9/, `${sourceName} ${continentId} progression should describe areas 7-9`)
    }
  }
})
