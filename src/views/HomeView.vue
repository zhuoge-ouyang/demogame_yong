<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { CONTINENTS } from '@/constants/continents'
import { PHASES } from '@/constants/phase-config'

const router = useRouter()
const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()

const phaseCards = computed(() => [
  {
    roman: 'I',
    kicker: 'ORIGIN OF REALMS',
    title: '世界框架与核心叙事',
    desc: '建立三界、玩家身份、英雄系统与女神城堡的底层神话。',
    route: '/phase1/realm-structure',
    image: '/images/banners/phase1.png',
    completion: worldStore.completionPercentage,
    accent: 'gold'
  },
  {
    roman: 'II',
    kicker: 'NINE CONTINENTS',
    title: '九大陆叙事设计',
    desc: '把九系元素大陆拆成主线、冲突、目标、体验与游戏表达。',
    route: '/phase2',
    image: '/images/banners/phase2.png',
    completion: continentsStore.overallCompletion,
    accent: 'verdigris'
  },
  {
    roman: 'III',
    kicker: 'LANDING EPIC',
    title: '前三大陆落地文案',
    desc: '完成金、冰、火三大陆的三幕九区、Boss身份与玩家短句。',
    route: '/phase3/jin',
    image: '/images/banners/phase3.png',
    completion: landingStore.overallCompletion,
    accent: 'blood'
  }
])

const overallCompletion = computed(() => {
  const total = phaseCards.value.reduce((sum, item) => sum + item.completion, 0)
  return Math.round(total / phaseCards.value.length)
})

const nextPhase = computed(() => phaseCards.value.find(item => item.completion < 100) || phaseCards.value[0])

const continentStates = computed(() =>
  CONTINENTS.map(continent => ({
    ...continent,
    completion: continentsStore.getContinentCompletion(continent.id)
  }))
)

const readyContinentCount = computed(() => continentStates.value.filter(item => item.completion === 100).length)

const nextModule = computed(() => {
  const modules = PHASES[0].modules
  return modules.find(module => !module.key.includes('batch')) || modules[0]
})

const storyPulse = computed(() => {
  const overview = worldStore.state.mainStoryline.overview || worldStore.state.realmStructure.summary
  if (!overview.trim()) return '等待第一段世界神话被点燃。'
  return overview.replace(/\s+/g, ' ').slice(0, 118) + (overview.length > 118 ? '...' : '')
})

function go(route: string) {
  router.push(route)
}
</script>

<template>
  <main class="forge-page">
    <section class="forge-hero" aria-label="世界观生成工作台">
      <div class="forge-hero__backdrop"></div>
      <div class="forge-hero__content">
        <div class="forge-copy">
          <div class="forge-kicker">WORLD FORGE · CHRONICLE ENGINE</div>
          <h1>魂域神话生成台</h1>
          <p>
            从三界根系到九大陆战役，把零散设定锻造成可落地、可评估、可持续扩写的西方魔幻世界。
          </p>
          <div class="forge-actions">
            <NButton type="primary" size="large" @click="go(nextPhase.route)">
              继续锻造第 {{ nextPhase.roman }} 章
            </NButton>
            <NButton size="large" ghost @click="go('/preview')">打开世界观预览</NButton>
          </div>
        </div>

        <aside class="forge-command">
          <div class="command-orb" :style="{ '--progress': `${overallCompletion}%` }">
            <span>{{ overallCompletion }}</span>
            <em>%</em>
          </div>
          <div class="command-meta">
            <span>总工程进度</span>
            <strong>{{ readyContinentCount }}/9 大陆完成</strong>
          </div>
          <p>{{ storyPulse }}</p>
          <div class="command-links">
            <button @click="go(nextModule.route)">核心设定</button>
            <button @click="go('/gallery')">素材库</button>
            <button @click="go('/assessment/start')">质量评测</button>
          </div>
        </aside>
      </div>
    </section>

    <section class="forge-grid" aria-label="创作阶段">
      <button
        v-for="phase in phaseCards"
        :key="phase.roman"
        class="phase-card"
        :class="`phase-card--${phase.accent}`"
        @click="go(phase.route)"
      >
        <img :src="phase.image" :alt="phase.title" />
        <span class="phase-card__veil"></span>
        <span class="phase-card__index">{{ phase.roman }}</span>
        <span class="phase-card__copy">
          <em>{{ phase.kicker }}</em>
          <strong>{{ phase.title }}</strong>
          <span>{{ phase.desc }}</span>
        </span>
        <span class="phase-card__progress">
          <i :style="{ width: `${phase.completion}%` }"></i>
          <b>{{ phase.completion }}%</b>
        </span>
      </button>
    </section>

    <section class="continent-atlas" aria-label="九大陆推进状态">
      <div class="atlas-head">
        <div>
          <span>ELEMENTAL ATLAS</span>
          <h2>九大陆战役盘</h2>
        </div>
        <NButton quaternary @click="go('/phase2')">进入大陆总览</NButton>
      </div>
      <div class="atlas-strip">
        <button
          v-for="continent in continentStates"
          :key="continent.id"
          class="atlas-node"
          :style="{ '--element': continent.color, '--completion': `${continent.completion}%` }"
          @click="go(`/phase2/${continent.id}`)"
        >
          <span class="atlas-node__icon">{{ continent.icon }}</span>
          <strong>{{ continent.name }}</strong>
          <em>{{ continent.element }} · {{ continent.completion }}%</em>
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.forge-page {
  width: 100%;
  height: calc(100vh - var(--header-height) - var(--tab-height));
  overflow-y: auto;
  padding: 18px;
}

.forge-hero {
  position: relative;
  min-height: min(620px, calc(100vh - 160px));
  border: 1px solid rgba(235, 204, 142, 0.18);
  overflow: hidden;
  background: #090907;
  box-shadow: 0 34px 90px -50px rgba(0, 0, 0, 0.95), inset 0 0 0 1px rgba(255, 240, 200, 0.05);
}

.forge-hero__backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(7, 7, 6, 0.92) 0%, rgba(7, 7, 6, 0.38) 42%, rgba(7, 7, 6, 0.72) 100%),
    radial-gradient(circle at 52% 31%, rgba(251, 208, 111, 0.2), transparent 32%),
    url('/images/generated/world-forge-cinematic.png') center / cover no-repeat;
  transform: scale(1.02);
}

.forge-hero::before {
  content: '';
  position: absolute;
  inset: 12px;
  border: 1px solid rgba(235, 204, 142, 0.16);
  pointer-events: none;
  z-index: 2;
}

.forge-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.5)),
    var(--epic-canvas-noise);
  opacity: 0.28;
  mix-blend-mode: soft-light;
  pointer-events: none;
}

.forge-hero__content {
  position: relative;
  z-index: 3;
  min-height: inherit;
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(340px, 420px);
  gap: 36px;
  align-items: end;
  padding: clamp(28px, 5vw, 72px);
}

.forge-copy {
  max-width: 760px;
}

.forge-kicker {
  font-family: var(--font-display-epic);
  font-size: 12px;
  letter-spacing: 0.38em;
  color: rgba(247, 218, 157, 0.88);
  margin-bottom: 18px;
}

.forge-copy h1 {
  max-width: 900px;
  font-family: var(--font-display-epic);
  font-size: clamp(44px, 7vw, 92px);
  line-height: 0.96;
  letter-spacing: 0.08em;
  color: #f4dfb5;
  margin: 0;
  text-shadow: 0 3px 24px rgba(0, 0, 0, 0.9), 0 0 42px rgba(212, 168, 83, 0.22);
}

.forge-copy p {
  max-width: 640px;
  margin: 22px 0 30px;
  color: rgba(236, 224, 198, 0.88);
  font-size: 17px;
  line-height: 1.85;
}

.forge-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.forge-command {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 18px;
  padding: 26px;
  background:
    linear-gradient(180deg, rgba(17, 16, 14, 0.72), rgba(8, 8, 7, 0.88)),
    radial-gradient(circle at 20% 0%, rgba(212, 168, 83, 0.18), transparent 42%);
  border: 1px solid rgba(236, 211, 157, 0.2);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.08);
}

.command-orb {
  width: 128px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  align-self: flex-start;
  background:
    radial-gradient(circle at center, rgba(8, 8, 7, 0.92) 0 53%, transparent 54%),
    conic-gradient(from -90deg, var(--epic-candle) var(--progress), rgba(255, 240, 200, 0.08) 0);
  box-shadow: 0 0 38px rgba(248, 207, 122, 0.18), inset 0 0 18px rgba(0, 0, 0, 0.8);
  font-family: var(--font-display-epic);
  color: var(--epic-halo);
}

.command-orb span {
  font-size: 42px;
  line-height: 1;
}

.command-orb em {
  position: absolute;
  transform: translate(38px, 18px);
  font-size: 13px;
  font-style: normal;
  color: var(--color-accent-gold-light);
}

.command-meta span,
.atlas-head span,
.phase-card__copy em {
  display: block;
  font-family: var(--font-display-epic);
  font-size: 11px;
  letter-spacing: 0.26em;
  color: rgba(248, 207, 122, 0.72);
}

.command-meta strong {
  display: block;
  margin-top: 4px;
  color: #f1dfba;
  font-size: 18px;
}

.forge-command p {
  color: rgba(223, 210, 184, 0.76);
  font-size: 14px;
  line-height: 1.7;
}

.command-links {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.command-links button {
  min-height: 38px;
  border: 1px solid rgba(248, 207, 122, 0.22);
  background: rgba(255, 240, 200, 0.05);
  color: rgba(240, 226, 196, 0.86);
  cursor: pointer;
  font-family: var(--font-serif-classic);
  transition: 180ms ease;
}

.command-links button:hover {
  border-color: rgba(248, 207, 122, 0.55);
  background: rgba(212, 168, 83, 0.14);
  color: var(--epic-halo);
}

.forge-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.phase-card {
  min-height: 250px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(235, 204, 142, 0.16);
  background: #10100e;
  text-align: left;
  cursor: pointer;
  padding: 0;
  color: var(--color-text);
  box-shadow: 0 18px 46px -32px rgba(0, 0, 0, 0.9);
}

.phase-card img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 700ms ease, filter 700ms ease;
}

.phase-card:hover img {
  transform: scale(1.05);
  filter: saturate(1.12) contrast(1.05);
}

.phase-card__veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 7, 6, 0.1), rgba(7, 7, 6, 0.9));
}

.phase-card__index {
  position: absolute;
  top: 18px;
  left: 18px;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(248, 207, 122, 0.32);
  background: rgba(7, 7, 6, 0.6);
  font-family: var(--font-display-epic);
  color: var(--epic-halo);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.12);
}

.phase-card__copy {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 48px;
}

.phase-card__copy strong {
  display: block;
  margin: 6px 0 8px;
  font-family: var(--font-display-epic);
  font-size: 22px;
  letter-spacing: 0.08em;
  color: #f2dfb6;
}

.phase-card__copy span {
  display: block;
  color: rgba(234, 220, 192, 0.78);
  line-height: 1.55;
}

.phase-card__progress {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 20px;
  height: 9px;
  background: rgba(255, 240, 200, 0.1);
  border: 1px solid rgba(255, 240, 200, 0.08);
}

.phase-card__progress i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--epic-candle), var(--epic-rust));
}

.phase-card__progress b {
  position: absolute;
  right: 0;
  bottom: 13px;
  color: var(--epic-halo);
  font-family: var(--font-display-epic);
  font-size: 11px;
  letter-spacing: 0.12em;
}

.continent-atlas {
  margin-top: 16px;
  padding: 22px;
  border: 1px solid rgba(235, 204, 142, 0.14);
  background:
    linear-gradient(180deg, rgba(17, 15, 12, 0.82), rgba(10, 9, 8, 0.94)),
    radial-gradient(circle at 10% 0%, rgba(90, 132, 114, 0.14), transparent 34%);
}

.atlas-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  margin-bottom: 16px;
}

.atlas-head h2 {
  color: #f2dfb6;
  margin: 4px 0 0;
  letter-spacing: 0.08em;
}

.atlas-strip {
  display: grid;
  grid-template-columns: repeat(9, minmax(92px, 1fr));
  gap: 8px;
}

.atlas-node {
  position: relative;
  min-height: 112px;
  padding: 14px 10px;
  border: 1px solid color-mix(in srgb, var(--element), transparent 48%);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.28)),
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--element), transparent 78%), transparent 60%);
  color: var(--color-text);
  cursor: pointer;
  overflow: hidden;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.atlas-node::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--element) var(--completion), rgba(255, 255, 255, 0.12) 0);
}

.atlas-node:hover {
  transform: translateY(-3px);
  border-color: var(--element);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.22)),
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--element), transparent 68%), transparent 60%);
}

.atlas-node__icon {
  display: block;
  font-size: 23px;
  margin-bottom: 10px;
}

.atlas-node strong {
  display: block;
  color: #f2dfb6;
  font-size: 13px;
}

.atlas-node em {
  display: block;
  margin-top: 3px;
  color: rgba(222, 211, 185, 0.62);
  font-style: normal;
  font-size: 12px;
}

@media (max-width: 1180px) {
  .forge-hero__content {
    grid-template-columns: 1fr;
    align-items: end;
  }

  .forge-command {
    max-width: 720px;
  }

  .atlas-strip {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 820px) {
  .forge-page {
    height: auto;
    min-height: calc(100vh - var(--header-height) - var(--tab-height));
    padding: 10px;
  }

  .forge-hero__content {
    padding: 28px 22px;
  }

  .forge-copy h1 {
    font-size: 42px;
  }

  .forge-grid {
    grid-template-columns: 1fr;
  }

  .command-links,
  .atlas-strip {
    grid-template-columns: 1fr;
  }
}
</style>
