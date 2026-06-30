import type { ContinentId } from '@/types/continent'

export interface ContinentMeta {
  id: ContinentId
  name: string
  element: string
  color: string
  icon: string
  description: string
}

export const CONTINENTS: ContinentMeta[] = [
  { id: 'jin', name: '金耀大陆', element: '金', color: '#C8A951', icon: '⚔️', description: '金属与锻造之地，骑士精神与荣耀的象征' },
  { id: 'mu', name: '翠森大陆', element: '木', color: '#4A9E5C', icon: '🌿', description: '生命与自然之地，万物生长的原始力量' },
  { id: 'bing', name: '霜寒大陆', element: '冰', color: '#6BB8D4', icon: '❄️', description: '冰雪与寂静之地，隐藏着被冰封的古老秘密' },
  { id: 'huo', name: '炎狱大陆', element: '火', color: '#D45B3E', icon: '🔥', description: '烈焰与锻造之地，永不熄灭的战火' },
  { id: 'tu', name: '磐岩大陆', element: '土', color: '#A67C52', icon: '🏔️', description: '大地与根基之地，坚不可摧的意志' },
  { id: 'feng', name: '风语大陆', element: '风', color: '#7EC8A0', icon: '🌪️', description: '风暴与自由之地，流浪者的国度' },
  { id: 'lei', name: '雷霆大陆', element: '雷', color: '#9B6BDB', icon: '⚡', description: '雷电与裁决之地，天罚降临之所' },
  { id: 'guang', name: '圣光大陆', element: '光', color: '#F0D264', icon: '✨', description: '光明与信仰之地，最接近神殿的存在' },
  { id: 'an', name: '暗影大陆', element: '暗', color: '#5C4B8A', icon: '🌑', description: '黑暗与深渊之地，封魂令的最终守护者' }
]

export const CONTINENT_MAP: Record<ContinentId, ContinentMeta> = Object.fromEntries(
  CONTINENTS.map(c => [c.id, c])
) as Record<ContinentId, ContinentMeta>

export const LANDING_CONTINENT_IDS: ContinentId[] = ['jin', 'bing', 'huo']
