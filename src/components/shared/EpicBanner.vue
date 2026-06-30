<script setup lang="ts">
/**
 * EpicBanner —— 史诗油画风格页头横幅
 *
 * 用法：
 *   <EpicBanner
 *     kicker="PHASE I · ORIGIN"
 *     title="世界框架与核心叙事"
 *     subtitle="定义三界的过去、现在与未来"
 *     image="/images/banner_phase1.png"
 *   />
 *
 * 设计意图：
 *   - 未上传图片时：显示"画框空位"装饰 + 主题色彩块
 *   - 上传图片后：图片作为底层，金框 + 暗角 + 浮雕文字覆盖其上
 */
import { computed } from 'vue'

interface Props {
  /** 小标识文字（英文大写） */
  kicker?: string
  /** 主标题 */
  title: string
  /** 副标题说明 */
  subtitle?: string
  /** 背景图片 URL，未提供时显示占位画框 */
  image?: string
  /** 盾徽中心标记（罗马数字或西式符号，如 I / II / III / ✠ / ✦） */
  sealChar?: string
  /** 高度档位：normal(170px) / tall(230px) / short(110px) */
  height?: 'normal' | 'tall' | 'short'
  /** 主色调：gold / blood / verdigris / moonlight  */
  accent?: 'gold' | 'blood' | 'verdigris' | 'moonlight'
}

const props = withDefaults(defineProps<Props>(), {
  kicker: '',
  subtitle: '',
  image: '',
  sealChar: 'I',
  height: 'normal',
  accent: 'gold'
})

const bannerStyle = computed(() => {
  const heights = { short: '140px', normal: '220px', tall: '300px' }
  return {
    '--banner-h': heights[props.height],
    backgroundImage: props.image ? `url(${props.image})` : undefined
  } as Record<string, string>
})

const hasImage = computed(() => !!props.image)
</script>

<template>
  <div
    class="epic-banner"
    :class="[`epic-banner--${accent}`, hasImage ? 'has-image' : 'no-image']"
    :style="bannerStyle"
  >
    <!-- 未上传图片时显示电影级占位油画：圣光光柱 + 世界树剪影 + 废墟残柱 + 云雾翻涌 -->
    <div v-if="!hasImage" class="epic-banner__placeholder-art" aria-hidden="true">
      <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice">
        <defs>
          <!-- 天空渐变：黄昏天空，从深紫到暖橙 -->
          <linearGradient id="ebSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2a1f38" />
            <stop offset="35%" stop-color="#5a3a38" />
            <stop offset="60%" stop-color="#c67848" />
            <stop offset="85%" stop-color="#f4c26b" />
            <stop offset="100%" stop-color="#2a1d12" />
          </linearGradient>
          <!-- 圣光光源（高处爆炸式光晕） -->
          <radialGradient id="ebHalo" cx="0.5" cy="0.35" r="0.35">
            <stop offset="0%" stop-color="#fff4d8" stop-opacity="0.95" />
            <stop offset="30%" stop-color="#f8cf7a" stop-opacity="0.6" />
            <stop offset="70%" stop-color="#c65c30" stop-opacity="0.18" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
          <!-- 右下剧铜如火 -->
          <radialGradient id="ebEmber" cx="0.9" cy="0.85" r="0.4">
            <stop offset="0%" stop-color="#f8cf7a" stop-opacity="0.5" />
            <stop offset="50%" stop-color="#8a2520" stop-opacity="0.25" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
          <!-- 远山剪影 -->
          <linearGradient id="ebMnt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4a2e28" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#1a0f0a" />
          </linearGradient>
          <!-- 云雾横条 -->
          <linearGradient id="ebMist" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="transparent" />
            <stop offset="50%" stop-color="rgba(248,207,122,0.38)" />
            <stop offset="100%" stop-color="transparent" />
          </linearGradient>
          <!-- 光柱（神圣天光） -->
          <linearGradient id="ebBeam" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stop-color="rgba(255,244,216,0.55)" />
            <stop offset="100%" stop-color="rgba(255,244,216,0)" />
          </linearGradient>
        </defs>

        <!-- 底层天空 -->
        <rect width="1200" height="320" fill="url(#ebSky)" />

        <!-- 远山连绵 -->
        <path d="M0 200 L120 160 L240 185 L360 140 L460 175 L580 120 L680 170 L800 125 L920 180 L1040 140 L1200 165 L1200 320 L0 320 Z"
              fill="url(#ebMnt)" opacity="0.7" />

        <!-- 光柱从天而降 -->
        <polygon points="540,30 660,30 780,310 420,310" fill="url(#ebBeam)" opacity="0.4" />
        <polygon points="570,40 630,40 680,305 520,305" fill="url(#ebBeam)" opacity="0.55" />

        <!-- 圣光光晕 -->
        <rect width="1200" height="320" fill="url(#ebHalo)" />

        <!-- 中央世界树剪影（垂直立十字树干 + 树冠剪影） -->
        <g opacity="0.78">
          <!-- 树干 -->
          <path d="M598 310 L598 160 L595 100 L600 55 L605 100 L602 160 L602 310 Z" fill="#0a0605" />
          <!-- 树枝（低多边形剪影） -->
          <path d="M600 90 L560 70 L535 85 L520 60 L545 50 L575 55 L600 40 L625 55 L655 50 L680 60 L665 85 L640 70 Z" fill="#0a0605" />
          <path d="M600 120 L555 108 L520 125 L495 105 L530 92 L570 96 L600 82 L630 96 L670 92 L705 105 L680 125 L645 108 Z" fill="#0a0605" />
          <path d="M600 150 L545 140 L508 158 L482 138 L518 122 L568 128 L600 112 L632 128 L682 122 L718 138 L692 158 L655 140 Z" fill="#0a0605" />
        </g>

        <!-- 左侧废墟残柱 -->
        <g opacity="0.85">
          <rect x="140" y="220" width="24" height="100" fill="#05060a" />
          <rect x="135" y="215" width="34" height="10" fill="#0a0a10" />
          <path d="M142 220 L140 218 L162 218 L164 220 Z" fill="#1a1812" />
          <rect x="280" y="255" width="16" height="65" fill="#05060a" />
          <rect x="276" y="250" width="24" height="8" fill="#0a0a10" />
        </g>

        <!-- 右侧废墟 -->
        <g opacity="0.85">
          <rect x="980" y="240" width="20" height="80" fill="#05060a" />
          <rect x="976" y="235" width="28" height="9" fill="#0a0a10" />
          <path d="M1040 260 L1030 258 L1080 258 L1090 260 L1085 320 L1035 320 Z" fill="#05060a" />
        </g>

        <!-- 远处渱坍塔塔 -->
        <polygon points="420,260 410,200 415,195 425,195 430,260" fill="#1a1008" opacity="0.8" />
        <polygon points="780,240 770,170 775,165 785,165 790,240" fill="#1a1008" opacity="0.8" />

        <!-- 云雾横条翻涌 -->
        <rect x="0" y="145" width="1200" height="12" fill="url(#ebMist)" opacity="0.6" />
        <rect x="0" y="195" width="1200" height="18" fill="url(#ebMist)" opacity="0.5" />
        <rect x="0" y="250" width="1200" height="22" fill="url(#ebMist)" opacity="0.4" />

        <!-- 炬余火点——飘浮灰烬 / 圣火粉尘 -->
        <circle cx="200" cy="80" r="1.4" fill="#f8cf7a" opacity="0.9" />
        <circle cx="340" cy="60" r="1" fill="#f8cf7a" opacity="0.7" />
        <circle cx="480" cy="45" r="1.6" fill="#fff4d8" opacity="0.95" />
        <circle cx="720" cy="50" r="1.2" fill="#f8cf7a" opacity="0.85" />
        <circle cx="860" cy="72" r="1" fill="#f8cf7a" opacity="0.7" />
        <circle cx="1020" cy="90" r="1.5" fill="#f8cf7a" opacity="0.8" />
        <circle cx="150" cy="130" r="0.8" fill="#fff4d8" opacity="0.6" />
        <circle cx="990" cy="150" r="0.9" fill="#fff4d8" opacity="0.7" />
        <circle cx="640" cy="210" r="1" fill="#f8cf7a" opacity="0.5" />

        <!-- 右下剧铜如火 -->
        <rect width="1200" height="320" fill="url(#ebEmber)" />

        <!-- 底部黑过渡 -->
        <rect x="0" y="280" width="1200" height="40" fill="url(#ebMnt)" opacity="0.5" />
      </svg>
      <div class="epic-banner__placeholder-tag">
        <span>AWAITING · CHRONICLE</span>
        <em>imago forma — pending</em>
      </div>
    </div>

    <!-- 暗角 + 颗粒 -->
    <div class="epic-banner__veil" aria-hidden="true"></div>

    <!-- 金框 -->
    <div class="epic-banner__frame" aria-hidden="true"></div>

    <!-- 四角装饰 -->
    <span class="epic-banner__corner epic-banner__corner--tl"></span>
    <span class="epic-banner__corner epic-banner__corner--tr"></span>
    <span class="epic-banner__corner epic-banner__corner--bl"></span>
    <span class="epic-banner__corner epic-banner__corner--br"></span>

    <!-- 文字区 -->
    <div class="epic-banner__content">
      <div class="epic-banner__seal" aria-hidden="true">
        <svg class="epic-banner__seal-bg" viewBox="0 0 100 110" preserveAspectRatio="xMidYMid meet">
          <defs>
            <!-- 石刻圆盘底色 -->
            <radialGradient id="cameoStone" cx="0.4" cy="0.35" r="0.85">
              <stop offset="0%" stop-color="#3a2e22"/>
              <stop offset="55%" stop-color="#2a1f15"/>
              <stop offset="100%" stop-color="#140c08"/>
            </radialGradient>
            <!-- 女神浮雕米川色渐变 -->
            <linearGradient id="cameoFig" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stop-color="#f0e2c0"/>
              <stop offset="50%" stop-color="#d8c49a"/>
              <stop offset="100%" stop-color="#8a7452"/>
            </linearGradient>
            <!-- 石杆圆环外框 -->
            <linearGradient id="cameoRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#4a3e32"/>
              <stop offset="50%" stop-color="#6a5c4a"/>
              <stop offset="100%" stop-color="#2a2218"/>
            </linearGradient>
          </defs>

          <!-- 外环（石棁圆框） -->
          <circle cx="50" cy="44" r="42" fill="url(#cameoRing)" />
          <circle cx="50" cy="44" r="42" fill="none" stroke="rgba(0,0,0,0.7)" stroke-width="0.8" />
          <circle cx="50" cy="44" r="39" fill="none" stroke="rgba(232,218,190,0.18)" stroke-width="0.5" />

          <!-- 凹陷内盘（浮雕背景） -->
          <circle cx="50" cy="44" r="36" fill="url(#cameoStone)" />

          <!-- 女神侧脸剪影（希腊雅典娜风，朝左看） -->
          <g transform="translate(50 44)">
            <!-- 头发后部（发髁） -->
            <path d="M 18 -16
                     C 18 -24, 12 -28, 4 -28
                     C -6 -28, -14 -20, -16 -8
                     C -18 2, -14 10, -8 14
                     L -6 22
                     L 14 22
                     L 14 18
                     C 14 12, 12 8, 10 4
                     L 2 0
                     L -4 -4
                     L 2 -8
                     L 2 -16
                     C 6 -20, 14 -20, 18 -16 Z"
                  fill="url(#cameoFig)"
                  opacity="0.88"/>
            <!-- 额头/鼻梁（希腊直鼻式） -->
            <path d="M 2 -16 L 2 -8 L -4 -4 L -4 -2 L 0 0 L 4 2 L 4 6 L 2 8 L 6 10 L 10 8 L 12 6 L 10 2 L 10 -4 L 14 -10 L 14 -14 L 10 -18 L 6 -18 Z"
                  fill="url(#cameoFig)"
                  opacity="0.3" />
            <!-- 发带/月桂冠横线 -->
            <path d="M -14 -12 Q 0 -18 16 -14"
                  fill="none"
                  stroke="rgba(248,223,170,0.55)"
                  stroke-width="1" />
            <!-- 月桂叶装饰点 -->
            <circle cx="-10" cy="-13" r="1.2" fill="rgba(248,223,170,0.65)" />
            <circle cx="-2" cy="-16" r="1.4" fill="rgba(248,223,170,0.75)" />
            <circle cx="8" cy="-15" r="1.2" fill="rgba(248,223,170,0.65)" />
            <!-- 脑后发髁折叠线 -->
            <path d="M -14 -6 Q -10 0 -12 8" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.6" />
            <path d="M -10 4 Q -4 8 -2 14" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.6" />
          </g>

          <!-- 底部石刻字条（罗马数字） -->
          <rect x="26" y="92" width="48" height="14" fill="#1a1208" stroke="rgba(232,218,190,0.22)" stroke-width="0.5"/>
          <rect x="27" y="93" width="46" height="12" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="0.3"/>
        </svg>
        <span class="epic-banner__seal-char">{{ sealChar }}</span>
      </div>
      <div class="epic-banner__text">
        <div v-if="kicker" class="epic-banner__kicker">{{ kicker }}</div>
        <h1 class="epic-banner__title">
          <span class="epic-banner__title-text">{{ title }}</span>
          <span class="epic-banner__title-rule" aria-hidden="true"></span>
        </h1>
        <div v-if="subtitle" class="epic-banner__subtitle">
          <span class="epic-banner__sub-line"></span>{{ subtitle }}
        </div>
      </div>
    </div>

    <slot name="actions" />
  </div>
</template>

<style scoped>
.epic-banner {
  position: relative;
  width: 100%;
  min-height: var(--banner-h, 220px);
  overflow: hidden;
  background-color: #140f0a;
  background-size: cover;
  background-position: center;
  border-top: 1px solid rgba(212, 168, 83, 0.3);
  border-bottom: 1px solid rgba(0, 0, 0, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.6),
    0 12px 32px -14px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  padding: 28px 44px;
  isolation: isolate;
  margin-bottom: 12px;
}

.epic-banner.no-image { background: #140f0a; }

/* SVG 占位油画 */
.epic-banner__placeholder-art {
  position: absolute; inset: 0;
  z-index: 0;
  pointer-events: none;
}
.epic-banner__placeholder-art svg { width: 100%; height: 100%; display: block; }
.epic-banner__placeholder-tag {
  position: absolute;
  bottom: 16px; right: 26px;
  display: flex; flex-direction: column; align-items: flex-end;
  font-family: var(--font-display-epic);
  color: rgba(248, 223, 170, 0.75);
  letter-spacing: 0.32em;
  font-size: 10px;
  text-transform: uppercase;
  line-height: 1.4;
  z-index: 4;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
.epic-banner__placeholder-tag em {
  font-style: normal;
  font-size: 10.5px;
  letter-spacing: 0.22em;
  color: rgba(216, 196, 154, 0.65);
  margin-top: 3px;
}

/* 暗角面纱 —— 加强中心聚光戏剧感 */
.epic-banner__veil {
  position: absolute; inset: 0;
  z-index: 1;
  background:
    radial-gradient(ellipse at center, transparent 0%, transparent 25%, rgba(0, 0, 0, 0.35) 75%, rgba(0, 0, 0, 0.75) 100%),
    linear-gradient(90deg, rgba(10, 8, 6, 0.82) 0%, rgba(10, 8, 6, 0.12) 40%, rgba(10, 8, 6, 0.12) 60%, rgba(10, 8, 6, 0.7) 100%);
  mix-blend-mode: multiply;
  pointer-events: none;
}
.epic-banner.no-image .epic-banner__veil {
  background:
    radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.32) 100%),
    linear-gradient(90deg, rgba(10, 8, 6, 0.5) 0%, transparent 40%, transparent 60%, rgba(10, 8, 6, 0.4) 100%);
}

/* 画框 —— 单层暗棕细边，去除双层金框 */
.epic-banner__frame {
  position: absolute;
  inset: 10px;
  z-index: 2;
  pointer-events: none;
  border: 1px solid rgba(255, 240, 200, 0.12);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.5),
    inset 0 0 24px rgba(0, 0, 0, 0.4);
}

/* 四角 —— 暗米色细线，去除金光drop-shadow */
.epic-banner__corner {
  position: absolute;
  width: 28px; height: 28px;
  z-index: 3;
  pointer-events: none;
  color: rgba(232, 218, 190, 0.55);
}
.epic-banner__corner::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px);
  opacity: 0;
}
.epic-banner__corner--tl { top: 14px; left: 14px; border-top: 1px solid; border-left: 1px solid; }
.epic-banner__corner--tr { top: 14px; right: 14px; border-top: 1px solid; border-right: 1px solid; }
.epic-banner__corner--bl { bottom: 14px; left: 14px; border-bottom: 1px solid; border-left: 1px solid; }
.epic-banner__corner--br { bottom: 14px; right: 14px; border-bottom: 1px solid; border-right: 1px solid; }

/* 文字内容 */
.epic-banner__content {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
}

/* 古典女神浮雕徽章 —— 替代盾形徽章 */
.epic-banner__seal {
  position: relative;
  width: 88px; height: 98px;
  display: grid; place-items: center;
  flex-shrink: 0;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.65));
}
.epic-banner__seal-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
}
/* 罗马数字——底部石刻字条，小号陶土米白色 */
.epic-banner__seal-char {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  z-index: 1;
  font-family: 'Cinzel', 'Trajan Pro', serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
  line-height: 1;
  color: rgba(232, 218, 190, 0.85);
  background: none;
  -webkit-text-fill-color: rgba(232, 218, 190, 0.85);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.9);
  padding: 0;
}

.epic-banner__text { flex: 1; min-width: 0; }

.epic-banner__kicker {
  font-family: var(--font-display-epic);
  font-size: 11px;
  letter-spacing: 0.45em;
  color: rgba(232, 218, 190, 0.75);
  opacity: 0.95;
  text-transform: uppercase;
  margin-bottom: 10px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px 4px 0;
}
.epic-banner__kicker::before {
  content: '❖';
  font-size: 8px;
  color: rgba(232, 218, 190, 0.5);
  letter-spacing: 0;
}

.epic-banner__title {
  /* 石刻碑铭式排版 —— 中文字距收紧，加重骨架感 */
  font-family: 'EB Garamond', 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(26px, 3vw, 40px);
  font-weight: 500;
  letter-spacing: 0.08em;
  margin: 0;
  padding-left: 0;
  color: #ead9b0;
  line-height: 1.2;
  text-transform: none;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.78), 0 1px 0 rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
  position: relative;
}

.epic-banner__title-text {
  display: inline-block;
  color: #ead9b0;
  -webkit-text-fill-color: #ead9b0;
}

/* 线条装饰 —— 细暗线，去除双划线金光与❖ */
.epic-banner__title-rule {
  display: block;
  width: 64px;
  height: 1px;
  margin-left: 2px;
  background: linear-gradient(90deg, rgba(232, 218, 190, 0.55), transparent);
}
.epic-banner__title-rule::after { content: none; }

.epic-banner__subtitle {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
  font-size: 14px;
  color: rgba(232, 218, 190, 0.9);
  letter-spacing: 0.08em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  font-family: var(--font-serif-classic);
}
.epic-banner__sub-line {
  width: 48px; height: 1px;
  background: linear-gradient(90deg, var(--epic-candle), transparent);
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(248, 207, 122, 0.5);
}

/* 色调变体 —— 女神浮雕有主色环境光，保持石刻感 */
.epic-banner--blood .epic-banner__seal {
  filter: drop-shadow(0 6px 14px rgba(0,0,0,0.7)) drop-shadow(0 0 14px rgba(198, 92, 48, 0.35));
}
.epic-banner--verdigris .epic-banner__seal {
  filter: drop-shadow(0 6px 14px rgba(0,0,0,0.7)) drop-shadow(0 0 14px rgba(90, 132, 114, 0.4));
}
.epic-banner--moonlight {
  border-top-color: rgba(196, 212, 232, 0.45);
  border-bottom-color: rgba(196, 212, 232, 0.45);
}
.epic-banner--moonlight .epic-banner__seal {
  filter: drop-shadow(0 6px 14px rgba(0,0,0,0.7)) drop-shadow(0 0 14px rgba(196, 212, 232, 0.4));
}

@media (max-width: 720px) {
  .epic-banner { padding: 18px 22px; min-height: 150px; }
  .epic-banner__seal { width: 62px; height: 70px; }
  .epic-banner__seal-char { font-size: 9px; bottom: 4px; }
  .epic-banner__title { font-size: 22px; letter-spacing: 0.06em; padding-left: 0; }
  .epic-banner__title-rule { width: 48px; }
  .epic-banner__corner { width: 22px; height: 22px; }
  .epic-banner__kicker { font-size: 10px; letter-spacing: 0.35em; }
}
</style>
