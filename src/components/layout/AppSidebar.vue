<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface SidebarItem {
  key: string
  label: string
  route: string
  completed?: boolean
}

const props = defineProps<{
  items: SidebarItem[]
}>()

const route = useRoute()
const router = useRouter()

function isActive(item: SidebarItem): boolean {
  return route.path === item.route
}

const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI']

function indexLabel(idx: number): string {
  return romanNumerals[idx] ?? String(idx + 1)
}
</script>

<template>
  <aside class="app-sidebar">
    <nav class="sidebar-nav">
      <button
        v-for="(item, idx) in items"
        :key="item.key"
        class="sidebar-item"
        :class="{ active: isActive(item), completed: item.completed }"
        @click="router.push(item.route)"
      >
        <span class="item-numeral">{{ indexLabel(idx) }}</span>
        <span class="item-label">{{ item.label }}</span>
        <span class="item-indicator" aria-hidden="true">
          <span v-if="item.completed" class="check">✓</span>
        </span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: var(--sidebar-width);
  border-right: 1px solid rgba(236, 204, 142, 0.13);
  background:
    linear-gradient(180deg, rgba(12, 13, 13, 0.98) 0%, rgba(8, 8, 7, 0.99) 100%),
    radial-gradient(circle at 0% 18%, rgba(79, 120, 148, 0.12), transparent 42%);
  overflow-y: auto;
  flex-shrink: 0;
  padding: 18px 12px;
  position: relative;
  box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.4);
}

/* 去除竖向金线装饰条 */
.app-sidebar::after { content: none; }

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 7px;
  position: relative;
}

.sidebar-nav::before {
  content: '';
  position: absolute;
  left: 24px;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(236, 204, 142, 0.24), transparent);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 10px 8px 8px;
  border: 1px solid rgba(255, 240, 200, 0.06);
  background: rgba(255, 240, 200, 0.025);
  cursor: pointer;
  border-radius: 0;
  font-family: var(--font-serif-classic, Georgia, serif);
  font-size: 13px;
  letter-spacing: 0.02em;
  color: rgba(218, 207, 181, 0.72);
  text-align: left;
  transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  width: 100%;
  position: relative;
}

.sidebar-item:hover {
  background: linear-gradient(90deg, rgba(212, 168, 83, 0.12), rgba(79, 120, 148, 0.05));
  color: var(--color-text);
  border-color: rgba(236, 204, 142, 0.22);
}

.sidebar-item.active {
  background:
    linear-gradient(90deg, rgba(248, 207, 122, 0.18) 0%, rgba(90, 132, 114, 0.06) 100%),
    rgba(0, 0, 0, 0.18);
  color: var(--epic-halo, #fff1c8);
  border-color: rgba(248, 207, 122, 0.42);
  font-weight: 600;
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.08),
    0 0 14px -2px rgba(248, 207, 122, 0.25);
}

/* 左侧烛火活动条 —— 金色竖线 + 柔光 */
.sidebar-item.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg,
    rgba(248, 207, 122, 0.1) 0%,
    #f8cf7a 30%,
    #d4a853 70%,
    rgba(212, 168, 83, 0.1) 100%);
  border-radius: 0 2px 2px 0;
  box-shadow:
    0 0 10px rgba(248, 207, 122, 0.8),
    0 0 18px rgba(212, 168, 83, 0.5);
}

/* 罗马数字序号 —— 默认暗石色，仅 hover/active 渐变金 */
.item-numeral {
  flex-shrink: 0;
  min-width: 32px;
  text-align: center;
  font-family: 'Cinzel', 'Trajan Pro', serif;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(200, 188, 168, 0.58);
  padding: 5px 4px;
  border: 1px solid rgba(255, 240, 200, 0.08);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.34);
  transition: all 0.25s ease;
  line-height: 1.2;
}

.sidebar-item:hover .item-numeral {
  color: var(--color-accent-gold-light, #e8c87a);
  border-color: rgba(212, 168, 83, 0.5);
}

.sidebar-item.active .item-numeral {
  color: var(--epic-halo, #fff1c8);
  border-color: rgba(248, 207, 122, 0.65);
  background: linear-gradient(180deg, rgba(212, 168, 83, 0.35), rgba(138, 90, 42, 0.25));
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.25);
}

.item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-indicator {
  flex-shrink: 0;
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check {
  font-size: 11px;
  color: var(--color-accent-gold, #d4a853);
  text-shadow: 0 0 6px rgba(212, 168, 83, 0.5);
}

.sidebar-item.completed .item-numeral {
  opacity: 0.55;
  text-decoration: line-through;
  text-decoration-color: rgba(212, 168, 83, 0.4);
}

.sidebar-item.completed .item-label {
  color: var(--color-text-tertiary, #8a7e6a);
}

.sidebar-item.completed.active .item-label {
  color: var(--epic-halo, #fff1c8);
}
</style>
