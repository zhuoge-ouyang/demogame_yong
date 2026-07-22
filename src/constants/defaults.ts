import type { WorldState, WorldTreeSystemData, OpeningBattleData } from '@/types/world'
import type { ContinentsState, ContinentAspects } from '@/types/continent'
import type { LandingsState, LandingContinent } from '@/types/landing'
import type { AIConfig } from '@/types/ai'
import { CONTINENTS } from './continents'

function emptyAspects(): ContinentAspects {
  return {
    mainPlot: '',
    coreConflict: '',
    playerGoal: '',
    storyGameplayConcept: '',
    experiencePositioning: '',
    inGameExpression: '',
    themeExpression: '',
    playerProgressionChanges: ''
  }
}

function emptyRegionOpponent() {
  return {
    name: '',
    identity: '',
    motivation: '',
    signatureLine: ''
  }
}

function emptyLanding(): LandingContinent {
  return {
    systemDialogue: { opening: '', actNodes: ['', '', ''] },
    bosses: ([1, 2, 3] as const).map((act) => ({
      name: '',
      identity: '',
      motivation: '',
      signatureLine: '',
      act,
      areaIndex: (act * 3) as 3 | 6 | 9
    })),
    levelNodes: Array.from({ length: 9 }, (_, i) => ({
      name: `区域${i + 1}`,
      act: (Math.floor(i / 3) + 1) as 1 | 2 | 3,
      storyPurpose: '',
      storyContent: '',
      entryPrompt: '',
      completionFeedback: '',
      narrativeReward: '',
      opponent: emptyRegionOpponent(),
      gameplayHandoff: ''
    })),
    _meta: {}
  }
}

export function defaultWorldState(): WorldState {
  return {
    realmStructure: {
      upper: { past: '', present: '', future: '' },
      mortal: { past: '', present: '', future: '' },
      abyss: { past: '', present: '', future: '' },
      summary: ''
    },
    mainStoryline: {
      stages: [
        { name: '第一章：金耀大陆', goal: '', events: '', resolution: '' },
        { name: '第二章：霜寒大陆', goal: '', events: '', resolution: '' },
        { name: '第三章：炎狱大陆', goal: '', events: '', resolution: '' }
      ],
      overview: ''
    },
    playerIdentity: {
      origin: '',
      initialPerception: '',
      revelationArc: '',
      gameplayIntegration: ''
    },
    heroSystem: CONTINENTS.map(c => ({
      id: c.id,
      name: '',
      element: c.element,
      continent: c.name,
      visual: '',
      backstory: '',
      personality: '',
      role: '',
      joinCondition: '',
      joinStage: '',
      storyRole: ''
    })),
    castleGoddess: {
      castle: { description: '', role: '', significance: '' },
      goddess: { name: '', appearance: '', personality: '', trueNature: '', guidanceStyle: '', dialogueThemes: '', truthMatrix: '' }
    },
    worldTreeSystem: {
      growthMechanism: '',
      resourceContribution: '',
      unlockedFeatures: '',
      fourthForce: '',
      runeConnection: ''
    },
    openingBattle: {
      sealAbyss: ''
    },
    _meta: {
      realmStructure: {},
      mainStoryline: {},
      playerIdentity: {},
      heroSystem: {},
      castleGoddess: {},
      worldTreeSystem: {},
      openingBattle: {}
    },
    moduleSummaries: {}
  }
}

export function defaultContinentsState(): ContinentsState {
  return Object.fromEntries(
    CONTINENTS.map(c => [c.id, { id: c.id, name: c.name, element: c.element, aspects: emptyAspects(), _meta: {} }])
  ) as ContinentsState
}

export function defaultLandingsState(): LandingsState {
  return {
    jin: emptyLanding(),
    mu: emptyLanding(),
    bing: emptyLanding(),
    huo: emptyLanding()
  }
}

export function defaultAIConfig(): AIConfig {
  return {
    provider: 'openai',
    apiKey: '',
    apiKeys: {},
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.8,
    maxTokens: 16384,
    image: {
      apiKey: '',
      baseUrl: '',
      model: 'gpt-image-2'
    }
  }
}
