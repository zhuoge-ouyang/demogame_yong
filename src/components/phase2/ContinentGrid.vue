<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CONTINENTS } from '@/constants/continents'
import { useContinentsStore } from '@/stores/continents'

const router = useRouter()
const continentsStore = useContinentsStore()

const continentCards = computed(() =>
  CONTINENTS.map((c, index) => ({
    ...c,
    index: index + 1,
    completion: continentsStore.getContinentCompletion(c.id)
  }))
)

function goToContinent(id: string) {
  router.push(`/phase2/${id}`)
}
</script>

<template>
  <div class="content-section continent-overview">
    <div class="continent-overview__intro">
      <div>
        <h2>九大陆叙事设计</h2>
        <p class="section-desc">选择元素大陆，逐项锻造主线剧情、核心冲突与玩家目标。</p>
      </div>
      <div class="overview-stamp">
        <span>{{ continentsStore.overallCompletion }}</span>
        <em>% 总进度</em>
      </div>
    </div>

    <div class="continent-grid">
      <button
        v-for="c in continentCards"
        :key="c.id"
        class="continent-card"
        :style="{ '--element-color': c.color, '--completion': `${c.completion}%` }"
        @click="goToContinent(c.id)"
      >
        <div class="card-index">{{ String(c.index).padStart(2, '0') }}</div>
        <div class="card-icon">
          <span>{{ c.icon }}</span>
        </div>
        <div class="card-info">
          <div class="card-kicker">{{ c.element }} ELEMENT</div>
          <div class="card-name">{{ c.name }}</div>
          <div class="card-desc">{{ c.description }}</div>
        </div>
        <div class="card-progress">
          <i></i>
          <b>{{ c.completion }}%</b>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.continent-overview {
  max-width: 1480px;
}

.continent-overview__intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
}

.overview-stamp {
  min-width: 112px;
  padding: 14px 16px;
  border: 1px solid rgba(236, 204, 142, 0.16);
  background: rgba(0, 0, 0, 0.18);
  text-align: center;
}

.overview-stamp span {
  display: block;
  font-family: var(--font-display-epic);
  font-size: 34px;
  color: var(--epic-halo);
  line-height: 1;
}

.overview-stamp em {
  display: block;
  margin-top: 4px;
  color: var(--color-text-tertiary);
  font-style: normal;
  font-size: 12px;
}

.continent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.continent-card {
  min-height: 190px;
  display: grid;
  grid-template-columns: 54px 1fr;
  grid-template-rows: 1fr auto;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--element-color), transparent 54%);
  border-radius: 0;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.045), rgba(0, 0, 0, 0.28)),
    radial-gradient(circle at 22% 0%, color-mix(in srgb, var(--element-color), transparent 76%), transparent 46%),
    rgba(12, 12, 11, 0.88);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--color-text);
  position: relative;
  overflow: hidden;
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

.continent-card::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid rgba(255, 240, 200, 0.06);
  pointer-events: none;
}

.continent-card:hover {
  border-color: var(--element-color);
  box-shadow: 0 20px 46px -34px var(--element-color);
  transform: translateY(-3px);
}

.card-index {
  position: relative;
  z-index: 1;
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 240, 200, 0.12);
  color: rgba(236, 224, 198, 0.55);
  font-family: var(--font-display-epic);
  font-size: 13px;
  letter-spacing: 0.16em;
  background: rgba(0, 0, 0, 0.24);
}

.card-icon {
  position: absolute;
  right: 18px;
  top: 16px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--element-color), transparent 82%);
  color: var(--element-color);
  font-size: 28px;
  box-shadow: 0 0 26px -14px var(--element-color);
}

.card-info {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  padding-right: 62px;
}

.card-kicker {
  font-family: var(--font-display-epic);
  font-size: 10px;
  letter-spacing: 0.26em;
  color: color-mix(in srgb, var(--element-color), white 26%);
  margin-bottom: 6px;
}

.card-name {
  font-family: var(--font-display-epic);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #f0dfb8;
}

.card-desc {
  font-size: 13.5px;
  color: rgba(220, 210, 184, 0.68);
  margin-top: 10px;
  line-height: 1.65;
}

.card-progress {
  grid-column: 1 / -1;
  position: relative;
  z-index: 1;
  height: 9px;
  background: rgba(255, 240, 200, 0.08);
  border: 1px solid rgba(255, 240, 200, 0.06);
}

.card-progress i {
  display: block;
  height: 100%;
  width: var(--completion);
  background: linear-gradient(90deg, var(--element-color), var(--epic-halo));
}

.card-progress b {
  position: absolute;
  right: 0;
  bottom: 13px;
  color: rgba(236, 224, 198, 0.78);
  font-size: 11px;
  font-family: var(--font-display-epic);
  letter-spacing: 0.12em;
}

@media (max-width: 900px) {
  .continent-grid {
    grid-template-columns: 1fr;
  }

  .continent-overview__intro {
    flex-direction: column;
  }
}
</style>
