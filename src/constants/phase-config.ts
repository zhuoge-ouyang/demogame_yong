export interface PhaseModule {
  key: string
  label: string
  route: string
  description: string
}

export interface PhaseConfig {
  id: number
  label: string
  description: string
  route: string
  modules: PhaseModule[]
}

export const PHASES: PhaseConfig[] = [
  {
    id: 1,
    label: '阶段一',
    description: '世界框架与核心叙事',
    route: '/phase1',
    modules: [
      { key: 'batch-import', label: '批量导入', route: '/phase1/batch-import', description: '粘贴世界观文本，自动解析填充各模块' },
      { key: 'realm-structure', label: '三界结构优化', route: '/phase1/realm-structure', description: '上界、凡界、深渊的过去、现状与未来展望' },
      { key: 'main-storyline', label: '主线三章节目标', route: '/phase1/main-storyline', description: '主角前三个元素大陆章节的核心目标梳理' },
      { key: 'player-identity', label: '玩家身份定义', route: '/phase1/player-identity', description: '玩家作为世界树节点的身份设定与揭示' },
      { key: 'hero-system', label: '英雄系统定位', route: '/phase1/hero-system', description: '九大陆九英雄的定位与设定' },
      { key: 'castle-goddess', label: '城堡与女神设定', route: '/phase1/castle-goddess', description: '城堡与女神的可见基础设定' }
    ]
  },
  {
    id: 2,
    label: '阶段二',
    description: '九大陆叙事设计',
    route: '/phase2',
    modules: []  // 动态生成，基于大陆数据
  },
  {
    id: 3,
    label: '阶段三',
    description: '前三大陆落地实现',
    route: '/phase3',
    modules: []  // 动态生成
  }
]
