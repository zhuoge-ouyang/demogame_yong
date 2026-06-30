<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NSelect, NSlider, NInputNumber, useMessage } from 'naive-ui'
import { useAIStore } from '@/stores/ai'
import { testAIConnection } from '@/services/ai-client'
import type { AIProvider } from '@/types/ai'
import type { TestConnectionResult } from '@/services/ai-client'

const show = defineModel<boolean>('show', { required: true })
const aiStore = useAIStore()
const message = useMessage()

const testing = ref(false)
const testResult = ref<TestConnectionResult | null>(null)
let testResultTimer: ReturnType<typeof setTimeout> | null = null

const activeTab = ref<'text' | 'image'>('text')
const showApiKey = ref(false)
const showImageApiKey = ref(false)

function clearTestResult() {
  if (testResultTimer) {
    clearTimeout(testResultTimer)
    testResultTimer = null
  }
  testResult.value = null
}

async function handleTestConnection() {
  if (!aiStore.config.apiKey.trim()) {
    message.warning('请先填写文字契约的 API Key')
    return
  }
  clearTestResult()
  testing.value = true
  try {
    const result = await testAIConnection(aiStore.config)
    testResult.value = result
    testResultTimer = setTimeout(() => {
      testResult.value = null
    }, 5000)
  } finally {
    testing.value = false
  }
}

watch(() => aiStore.config, clearTestResult, { deep: true })

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Claude (Anthropic)', value: 'claude' },
  { label: '通义千问 (Qwen)', value: 'qwen' },
  { label: '豆包 (Doubao)', value: 'doubao' },
  { label: 'Kimi 2.5', value: 'kimi' },
  { label: 'Minimax', value: 'minimax' }
]

interface ProviderDefaults {
  model: string
  baseUrl: string
  models: { label: string; value: string }[]
}

const providerConfig: Record<AIProvider, ProviderDefaults> = {
  openai: {
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
      { label: 'GPT-4-turbo', value: 'gpt-4-turbo' }
    ]
  },
  claude: {
    model: 'claude-3-5-sonnet-20241022',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
      { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
      { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' }
    ]
  },
  qwen: {
    model: 'qwen-max',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { label: 'Qwen3.6-Plus', value: 'qwen3.6-plus' },
      { label: 'Qwen-Max', value: 'qwen-max' },
      { label: 'Qwen-Plus', value: 'qwen-plus' },
      { label: 'Qwen-Turbo', value: 'qwen-turbo' },
      { label: 'Qwen-Long', value: 'qwen-long' }
    ]
  },
  doubao: {
    model: 'doubao-1.5-pro-32k',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { label: '豆包 1.5 Pro 32k', value: 'doubao-1.5-pro-32k' },
      { label: '豆包 1.5 Lite 32k', value: 'doubao-1.5-lite-32k' },
      { label: '豆包 Pro 32k', value: 'doubao-pro-32k' },
      { label: '豆包 Lite 32k', value: 'doubao-lite-32k' }
    ]
  },
  kimi: {
    model: 'kimi-k2.5',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { label: 'Kimi K2.5 (256k)', value: 'kimi-k2.5' },
      { label: 'Kimi K2 Turbo Preview (256k)', value: 'kimi-k2-turbo-preview' },
      { label: 'Kimi K2 Thinking (256k)', value: 'kimi-k2-thinking' },
      { label: 'Kimi K2 0905 Preview (256k)', value: 'kimi-k2-0905-preview' },
      { label: 'Moonshot v1 128k', value: 'moonshot-v1-128k' },
      { label: 'Moonshot v1 32k', value: 'moonshot-v1-32k' }
    ]
  },
  minimax: {
    model: 'MiniMax-Text-01',
    baseUrl: 'https://api.minimax.chat/v1',
    models: [
      { label: 'MiniMax-Text-01', value: 'MiniMax-Text-01' },
      { label: 'abab6.5s-chat', value: 'abab6.5s-chat' },
      { label: 'abab6.5-chat', value: 'abab6.5-chat' },
      { label: 'abab5.5-chat', value: 'abab5.5-chat' }
    ]
  }
}

const imageModelOptions = [
  { label: 'GPT Image', value: 'gpt-image-2' },
  { label: 'DALL·E 3', value: 'dall-e-3' },
  { label: 'Flux Pro', value: 'flux-pro' },
  { label: 'Stable Diffusion 3', value: 'sd3' }
]

const modelOptions = computed(() => providerConfig[aiStore.config.provider]?.models ?? [])

const apiKeyPlaceholder = computed(() => {
  const placeholders: Record<AIProvider, string> = {
    openai: '输入 OpenAI API Key (sk-...)',
    claude: '输入 Anthropic API Key',
    qwen: '输入阿里云 DashScope API Key',
    doubao: '输入火山引擎 API Key',
    kimi: '输入 Moonshot API Key',
    minimax: '输入 MiniMax API Key'
  }
  return placeholders[aiStore.config.provider] ?? '输入 API Key'
})

const providerHint = computed(() => {
  const hints: Record<AIProvider, string> = {
    openai: '',
    claude: '',
    qwen: '通义千问使用 DashScope OpenAI 兼容接口',
    doubao: '豆包使用火山引擎 OpenAI 兼容接口',
    kimi: 'Kimi 使用 Moonshot OpenAI 兼容接口，API Key 请在 platform.moonshot.cn 获取',
    minimax: 'MiniMax 使用 OpenAI 兼容接口'
  }
  return hints[aiStore.config.provider] ?? ''
})

function onProviderChange(value: string) {
  const provider = value as AIProvider
  const defaults = providerConfig[provider]
  aiStore.updateConfig({
    provider,
    model: defaults.model,
    baseUrl: defaults.baseUrl
  })
}

function updateImage(partial: { apiKey?: string; baseUrl?: string; model?: string }) {
  const current = aiStore.config.image ?? {
    apiKey: '',
    baseUrl: '',
    model: 'gpt-image-2'
  }
  aiStore.updateConfig({ image: { ...current, ...partial } })
}

const imageCfg = computed(() => aiStore.config.image ?? {
  apiKey: '',
  baseUrl: '',
  model: 'gpt-image-2'
})

function maskKey(k: string, show: boolean) {
  if (!k) return ''
  if (show) return k
  if (k.length <= 8) return '•'.repeat(k.length)
  return k.slice(0, 4) + '•'.repeat(Math.max(4, k.length - 8)) + k.slice(-4)
}
</script>

<template>
  <NModal
    v-model:show="show"
    :mask-closable="true"
    :auto-focus="false"
    display-directive="if"
    transform-origin="center"
    class="arcanum-modal-wrap"
  >
    <div class="arcanum-pact" role="dialog" aria-label="AI 契约台">
      <!-- 背景装饰 -->
      <div class="ap-bg-aurora" aria-hidden="true"></div>
      <div class="ap-bg-grain" aria-hidden="true"></div>
      <svg class="ap-corner ap-corner--tl" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M2 40 L2 2 L40 2" fill="none" stroke="currentColor" stroke-width="1.2" />
        <circle cx="2" cy="2" r="3" fill="currentColor" />
      </svg>
      <svg class="ap-corner ap-corner--tr" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M78 40 L78 2 L40 2" fill="none" stroke="currentColor" stroke-width="1.2" />
        <circle cx="78" cy="2" r="3" fill="currentColor" />
      </svg>
      <svg class="ap-corner ap-corner--bl" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M2 40 L2 78 L40 78" fill="none" stroke="currentColor" stroke-width="1.2" />
        <circle cx="2" cy="78" r="3" fill="currentColor" />
      </svg>
      <svg class="ap-corner ap-corner--br" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M78 40 L78 78 L40 78" fill="none" stroke="currentColor" stroke-width="1.2" />
        <circle cx="78" cy="78" r="3" fill="currentColor" />
      </svg>

      <!-- 顶部 -->
      <header class="ap-header">
        <div class="ap-header__sigil">
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="1" opacity="0.55" />
            <circle cx="30" cy="30" r="18" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.35" />
            <path d="M30 4 L32 28 L56 30 L32 32 L30 56 L28 32 L4 30 L28 28 Z" fill="currentColor" opacity="0.9" />
          </svg>
        </div>
        <div class="ap-header__title">
          <div class="ap-kicker">ARCANUM · PACT</div>
          <h2>AI 契约台</h2>
          <p class="ap-sub">在此封缄与诸神之脑的文字与影像契约</p>
        </div>
        <button class="ap-close" aria-label="关闭" @click="show = false">
          <svg viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
        </button>
      </header>

      <!-- Tab 切换 -->
      <nav class="ap-tabs" role="tablist">
        <button
          class="ap-tab"
          :class="{ 'ap-tab--active': activeTab === 'text' }"
          role="tab"
          :aria-selected="activeTab === 'text'"
          @click="activeTab = 'text'"
        >
          <span class="ap-tab__rune">☿</span>
          <span class="ap-tab__label">文字契约</span>
          <span class="ap-tab__en">LEX · TEXTUS</span>
        </button>
        <button
          class="ap-tab"
          :class="{ 'ap-tab--active': activeTab === 'image' }"
          role="tab"
          :aria-selected="activeTab === 'image'"
          @click="activeTab = 'image'"
        >
          <span class="ap-tab__rune">✦</span>
          <span class="ap-tab__label">影像契约</span>
          <span class="ap-tab__en">IMAGO · FORMA</span>
        </button>
      </nav>

      <!-- 内容区 -->
      <section class="ap-body">
        <transition name="ap-fade" mode="out-in">
          <!-- 文字契约 -->
          <div v-if="activeTab === 'text'" key="text" class="ap-grimoire">
            <div class="ap-field">
              <label class="ap-label"><span>★</span>AI 提供商</label>
              <div class="ap-control">
                <NSelect
                  :value="aiStore.config.provider"
                  :options="providerOptions"
                  @update:value="onProviderChange"
                />
              </div>
            </div>

            <transition name="ap-fade">
              <div v-if="providerHint" class="ap-hint">
                <span class="ap-hint__icon">ℹ</span>{{ providerHint }}
              </div>
            </transition>

            <div class="ap-field">
              <label class="ap-label"><span>◈</span>API Key</label>
              <div class="ap-control ap-input-wrap">
                <input
                  class="ap-input"
                  :type="showApiKey ? 'text' : 'password'"
                  :value="aiStore.config.apiKey"
                  :placeholder="apiKeyPlaceholder"
                  autocomplete="off"
                  spellcheck="false"
                  @input="(e: Event) => aiStore.updateConfig({ apiKey: (e.target as HTMLInputElement).value })"
                />
                <button class="ap-eye" type="button" :title="showApiKey ? '隐藏' : '显示'" @click="showApiKey = !showApiKey">
                  <svg v-if="showApiKey" viewBox="0 0 24 24"><path d="M3 12 Q12 4 21 12 Q12 20 3 12 Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
                  <svg v-else viewBox="0 0 24 24"><path d="M3 12 Q12 4 21 12 Q12 20 3 12 Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 4 L20 20" stroke="currentColor" stroke-width="1.4"/></svg>
                </button>
              </div>
            </div>

            <div class="ap-field">
              <label class="ap-label"><span>◇</span>接口地址</label>
              <div class="ap-control">
                <input
                  class="ap-input"
                  :value="aiStore.config.baseUrl"
                  placeholder="API Base URL"
                  @input="(e: Event) => aiStore.updateConfig({ baseUrl: (e.target as HTMLInputElement).value })"
                />
              </div>
            </div>

            <div class="ap-field">
              <label class="ap-label"><span>✧</span>模型</label>
              <div class="ap-control">
                <NSelect
                  :value="aiStore.config.model"
                  :options="modelOptions"
                  filterable
                  tag
                  @update:value="(v: string) => aiStore.updateConfig({ model: v })"
                />
              </div>
            </div>

            <div class="ap-row">
              <div class="ap-field ap-field--half">
                <label class="ap-label"><span>◐</span>温度
                  <em class="ap-label__val">{{ aiStore.config.temperature.toFixed(1) }}</em>
                </label>
                <div class="ap-control">
                  <NSlider
                    :value="aiStore.config.temperature"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    @update:value="(v: number) => aiStore.updateConfig({ temperature: v })"
                  />
                  <div class="ap-temp-hint">
                    <span>克制</span><span>平衡</span><span>狂想</span>
                  </div>
                </div>
              </div>
              <div class="ap-field ap-field--half">
                <label class="ap-label"><span>⌘</span>最大 Token</label>
                <div class="ap-control">
                  <NInputNumber
                    :value="aiStore.config.maxTokens"
                    :min="256"
                    :max="131072"
                    :step="1024"
                    @update:value="(v: number | null) => aiStore.updateConfig({ maxTokens: v ?? 4096 })"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 影像契约 -->
          <div v-else key="image" class="ap-grimoire">
            <div class="ap-pact-banner">
              <div class="ap-pact-banner__orb"></div>
              <div>
                <div class="ap-pact-banner__title">影像契约 · IMAGO FORMA</div>
                <div class="ap-pact-banner__desc">调用图像大模型，将叙事凝为一帧永恒。</div>
              </div>
              <span class="ap-badge">图像生成</span>
            </div>

            <div class="ap-field">
              <label class="ap-label"><span>✦</span>图像模型</label>
              <div class="ap-control">
                <NSelect
                  :value="imageCfg.model"
                  :options="imageModelOptions"
                  filterable
                  tag
                  @update:value="(v: string) => updateImage({ model: v })"
                />
              </div>
            </div>

            <div class="ap-field">
              <label class="ap-label"><span>◈</span>API Key</label>
              <div class="ap-control ap-input-wrap">
                <input
                  class="ap-input"
                  :type="showImageApiKey ? 'text' : 'password'"
                  :value="imageCfg.apiKey"
                  placeholder="输入图像模型 API Key"
                  autocomplete="off"
                  spellcheck="false"
                  @input="(e: Event) => updateImage({ apiKey: (e.target as HTMLInputElement).value })"
                />
                <button class="ap-eye" type="button" :title="showImageApiKey ? '隐藏' : '显示'" @click="showImageApiKey = !showImageApiKey">
                  <svg v-if="showImageApiKey" viewBox="0 0 24 24"><path d="M3 12 Q12 4 21 12 Q12 20 3 12 Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
                  <svg v-else viewBox="0 0 24 24"><path d="M3 12 Q12 4 21 12 Q12 20 3 12 Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 4 L20 20" stroke="currentColor" stroke-width="1.4"/></svg>
                </button>
              </div>
              <div v-if="imageCfg.apiKey" class="ap-keymask">当前：{{ maskKey(imageCfg.apiKey, showImageApiKey) }}</div>
            </div>

            <div class="ap-field">
              <label class="ap-label"><span>◇</span>接口地址</label>
              <div class="ap-control">
                <input
                  class="ap-input"
                  :value="imageCfg.baseUrl"
                  placeholder="API Base URL"
                  @input="(e: Event) => updateImage({ baseUrl: (e.target as HTMLInputElement).value })"
                />
              </div>
            </div>

            <div class="ap-hint ap-hint--soft">
              <span class="ap-hint__icon">✧</span>
              图像模型和接口地址需要按实际供应商配置填写。
            </div>
          </div>
        </transition>
      </section>

      <!-- 底部 -->
      <footer class="ap-footer">
        <div class="ap-footer__left">
          <button
            class="ap-btn ap-btn--ghost"
            :disabled="testing"
            @click="handleTestConnection"
          >
            <span v-if="!testing" class="ap-btn__rune">⌁</span>
            <span v-else class="ap-spinner" aria-hidden="true"></span>
            {{ testing ? '施术中…' : '试炼契约' }}
          </button>
          <transition name="ap-fade">
            <div
              v-if="testResult"
              class="ap-result"
              :class="`ap-result--${testResult.type}`"
            >
              <span class="ap-result__dot"></span>
              {{ testResult.message }}
            </div>
          </transition>
        </div>
        <button class="ap-btn ap-btn--primary" @click="show = false">
          <span class="ap-btn__rune">✦</span>封缄契约
        </button>
      </footer>
    </div>
  </NModal>
</template>

<style scoped>
/* ───────── Modal 外壳 ───────── */
.arcanum-modal-wrap :deep(.n-modal-mask) {
  background: radial-gradient(ellipse at center, rgba(10, 14, 26, 0.85) 0%, rgba(5, 6, 12, 0.96) 70%);
  backdrop-filter: blur(6px) saturate(120%);
}

.arcanum-pact {
  position: relative;
  width: min(640px, 94vw);
  max-height: min(88vh, 820px);
  display: flex;
  flex-direction: column;
  color: var(--color-text, #e8e0d0);
  font-family: var(--font-sans);
  background:
    linear-gradient(160deg, rgba(36, 27, 18, 0.95) 0%, rgba(18, 13, 9, 0.97) 55%, rgba(28, 21, 14, 0.94) 100%);
  border: 1px solid rgba(212, 168, 83, 0.28);
  border-radius: 4px;
  box-shadow:
    0 0 0 1px rgba(212, 168, 83, 0.08) inset,
    0 40px 80px -20px rgba(0, 0, 0, 0.85),
    0 0 60px -10px rgba(212, 168, 83, 0.22);
  overflow: hidden;
  isolation: isolate;
  animation: ap-rise 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes ap-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

.ap-bg-aurora {
  position: absolute; inset: -40%;
  background:
    radial-gradient(circle at 20% 10%, rgba(212, 168, 83, 0.22), transparent 45%),
    radial-gradient(circle at 85% 90%, rgba(124, 92, 191, 0.18), transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(74, 144, 217, 0.08), transparent 60%);
  filter: blur(36px);
  z-index: -2;
  animation: ap-aurora 18s ease-in-out infinite alternate;
}
@keyframes ap-aurora {
  from { transform: rotate(0) scale(1); }
  to   { transform: rotate(12deg) scale(1.08); }
}

.ap-bg-grain {
  position: absolute; inset: 0;
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px);
  pointer-events: none;
  z-index: -1;
  mix-blend-mode: overlay;
}

/* 四角符文 */
.ap-corner {
  position: absolute; width: 36px; height: 36px;
  color: var(--color-accent-gold, #d4a853);
  opacity: 0.85;
  pointer-events: none;
  filter: drop-shadow(0 0 6px rgba(212, 168, 83, 0.4));
}
.ap-corner--tl { top: 8px; left: 8px; }
.ap-corner--tr { top: 8px; right: 8px; }
.ap-corner--bl { bottom: 8px; left: 8px; }
.ap-corner--br { bottom: 8px; right: 8px; }

/* ───────── Header ───────── */
.ap-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 28px 32px 22px;
  border-bottom: 1px solid rgba(212, 168, 83, 0.18);
  position: relative;
}
.ap-header::after {
  content: '';
  position: absolute;
  left: 32px; right: 32px; bottom: -1px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 168, 83, 0.55), transparent);
}

.ap-header__sigil {
  width: 56px; height: 56px;
  color: var(--color-accent-gold, #d4a853);
  display: grid; place-items: center;
  animation: ap-spin 22s linear infinite;
  filter: drop-shadow(0 0 10px rgba(212, 168, 83, 0.5));
}
.ap-header__sigil svg { width: 100%; height: 100%; }
@keyframes ap-spin { to { transform: rotate(360deg); } }

.ap-kicker {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 10px;
  letter-spacing: 0.42em;
  color: var(--color-accent-gold, #d4a853);
  opacity: 0.85;
  margin-bottom: 2px;
}
.ap-header__title h2 {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 26px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.08em;
  color: #f0e3c3;
  text-shadow: 0 0 18px rgba(212, 168, 83, 0.3);
}
.ap-sub {
  font-size: 12px;
  color: var(--color-text-secondary, #9b8e7e);
  margin: 4px 0 0;
  letter-spacing: 0.04em;
}

.ap-close {
  width: 34px; height: 34px;
  background: transparent;
  border: 1px solid rgba(212, 168, 83, 0.3);
  border-radius: 2px;
  color: var(--color-text-secondary, #9b8e7e);
  cursor: pointer;
  display: grid; place-items: center;
  transition: all 220ms ease;
}
.ap-close svg { width: 14px; height: 14px; }
.ap-close:hover {
  color: var(--color-accent-gold, #d4a853);
  border-color: var(--color-accent-gold, #d4a853);
  box-shadow: 0 0 12px rgba(212, 168, 83, 0.4);
  transform: rotate(90deg);
}

/* ───────── Tabs ───────── */
.ap-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 16px 32px 0;
  gap: 10px;
}
.ap-tab {
  position: relative;
  background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
  border: 1px solid rgba(212, 168, 83, 0.18);
  border-radius: 2px;
  padding: 12px 16px;
  display: flex; align-items: center; gap: 10px;
  color: var(--color-text-secondary, #9b8e7e);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
}
.ap-tab::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at 30% 50%, rgba(212, 168, 83, 0.18), transparent 60%);
  opacity: 0;
  transition: opacity 300ms ease;
}
.ap-tab:hover { color: var(--color-text, #e8e0d0); border-color: rgba(212, 168, 83, 0.45); }
.ap-tab:hover::before { opacity: 0.8; }
.ap-tab__rune {
  color: var(--color-accent-gold, #d4a853);
  font-size: 18px;
  filter: drop-shadow(0 0 4px rgba(212, 168, 83, 0.5));
}
.ap-tab__label {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.06em;
  z-index: 1;
}
.ap-tab__en {
  margin-left: auto;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 10px;
  letter-spacing: 0.28em;
  opacity: 0.5;
  z-index: 1;
}
.ap-tab--active {
  color: var(--color-accent-gold, #d4a853);
  border-color: rgba(212, 168, 83, 0.7);
  background: linear-gradient(180deg, rgba(212, 168, 83, 0.14), rgba(212, 168, 83, 0.03));
  box-shadow: 0 0 24px -4px rgba(212, 168, 83, 0.5), inset 0 1px 0 rgba(212, 168, 83, 0.25);
}
.ap-tab--active .ap-tab__en { opacity: 0.8; }

/* ───────── Body ───────── */
.ap-body {
  padding: 22px 32px;
  flex: 1; overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(212, 168, 83, 0.3) transparent;
}
.ap-body::-webkit-scrollbar { width: 6px; }
.ap-body::-webkit-scrollbar-thumb { background: rgba(212, 168, 83, 0.3); border-radius: 3px; }

.ap-grimoire { display: flex; flex-direction: column; gap: 18px; }

.ap-field { display: flex; flex-direction: column; gap: 8px; }
.ap-field--half { flex: 1; }

.ap-row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start; }

.ap-label {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary, #9b8e7e);
  text-transform: uppercase;
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-display, 'Cinzel', serif);
}
.ap-label span {
  color: var(--color-accent-gold, #d4a853);
  font-size: 14px;
  filter: drop-shadow(0 0 3px rgba(212, 168, 83, 0.4));
}
.ap-label__val {
  margin-left: auto;
  font-style: normal;
  color: var(--color-accent-gold, #d4a853);
  font-size: 13px;
  letter-spacing: 0;
}

.ap-control { position: relative; }

/* 原生 input 定制 */
.ap-input {
  width: 100%;
  background: linear-gradient(180deg, rgba(14, 10, 7, 0.85), rgba(28, 21, 14, 0.7));
  border: 1px solid rgba(212, 168, 83, 0.22);
  color: var(--color-text, #e8e0d0);
  padding: 10px 14px;
  font-size: 14px;
  font-family: 'JetBrains Mono', 'Menlo', ui-monospace, monospace;
  border-radius: 2px;
  outline: none;
  transition: all 220ms ease;
  letter-spacing: 0.02em;
}
.ap-input::placeholder { color: rgba(155, 142, 126, 0.5); font-family: var(--font-sans); }
.ap-input:hover { border-color: rgba(212, 168, 83, 0.45); }
.ap-input:focus {
  border-color: var(--color-accent-gold, #d4a853);
  box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.12), 0 0 18px -4px rgba(212, 168, 83, 0.45);
}

.ap-input-wrap { position: relative; }
.ap-input-wrap .ap-input { padding-right: 44px; }
.ap-eye {
  position: absolute; right: 8px; top: 50%;
  transform: translateY(-50%);
  width: 28px; height: 28px;
  display: grid; place-items: center;
  background: transparent; border: none;
  color: var(--color-text-secondary, #9b8e7e);
  cursor: pointer;
  border-radius: 2px;
  transition: color 200ms ease;
}
.ap-eye svg { width: 16px; height: 16px; }
.ap-eye:hover { color: var(--color-accent-gold, #d4a853); }

.ap-keymask {
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-tertiary, #6b6058);
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.05em;
}

/* Hint */
.ap-hint {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(90deg, rgba(212, 168, 83, 0.12), rgba(212, 168, 83, 0.03));
  border-left: 2px solid rgba(212, 168, 83, 0.55);
  color: #d8c49a;
  font-size: 12.5px;
  border-radius: 0 2px 2px 0;
  line-height: 1.6;
}
.ap-hint--soft {
  background: linear-gradient(90deg, rgba(212, 168, 83, 0.1), rgba(212, 168, 83, 0.02));
  border-left-color: rgba(212, 168, 83, 0.55);
  color: var(--color-text-secondary, #9b8e7e);
}
.ap-hint--soft code {
  background: rgba(212, 168, 83, 0.15);
  color: var(--color-accent-gold, #d4a853);
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 12px;
}
.ap-hint__icon {
  color: var(--color-accent-gold, #d4a853);
  font-size: 14px;
  line-height: 1.4;
  flex-shrink: 0;
}

/* 温度刻度 */
.ap-temp-hint {
  display: flex; justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: var(--color-text-tertiary, #6b6058);
  letter-spacing: 0.1em;
}

/* 影像契约专属 banner */
.ap-pact-banner {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
  background: linear-gradient(110deg, rgba(124, 92, 191, 0.18) 0%, rgba(212, 168, 83, 0.08) 100%);
  border: 1px solid rgba(124, 92, 191, 0.35);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}
.ap-pact-banner::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 100% 0%, rgba(212, 168, 83, 0.2), transparent 60%);
  pointer-events: none;
}
.ap-pact-banner__orb {
  width: 38px; height: 38px; border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, #e8c87a, #d4a853 40%, #7c5cbf 80%);
  box-shadow: 0 0 20px rgba(212, 168, 83, 0.5), inset 0 0 8px rgba(255,255,255,0.35);
  flex-shrink: 0;
  animation: ap-orb 3.2s ease-in-out infinite;
}
@keyframes ap-orb {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(212, 168, 83, 0.5), inset 0 0 8px rgba(255,255,255,0.35); }
  50% { transform: scale(1.06); box-shadow: 0 0 28px rgba(212, 168, 83, 0.7), inset 0 0 12px rgba(255,255,255,0.45); }
}
.ap-pact-banner__title {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 14px;
  color: #f0e3c3;
  letter-spacing: 0.1em;
}
.ap-pact-banner__desc {
  font-size: 12px;
  color: var(--color-text-secondary, #9b8e7e);
  margin-top: 2px;
}
.ap-badge {
  margin-left: auto;
  font-size: 10px;
  letter-spacing: 0.22em;
  padding: 4px 10px;
  border: 1px solid rgba(212, 168, 83, 0.5);
  color: var(--color-accent-gold, #d4a853);
  border-radius: 2px;
  z-index: 1;
}

/* ───────── Footer ───────── */
.ap-footer {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px;
  padding: 18px 32px 24px;
  border-top: 1px solid rgba(212, 168, 83, 0.18);
  position: relative;
}
.ap-footer::before {
  content: '';
  position: absolute; top: -1px; left: 32px; right: 32px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 168, 83, 0.55), transparent);
}
.ap-footer__left { display: flex; flex-direction: column; gap: 6px; }

.ap-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 13px;
  letter-spacing: 0.15em;
  border-radius: 2px;
  cursor: pointer;
  transition: all 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative;
  overflow: hidden;
  user-select: none;
}
.ap-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ap-btn__rune { font-size: 14px; }

.ap-btn--ghost {
  background: transparent;
  border: 1px solid rgba(212, 168, 83, 0.4);
  color: var(--color-accent-gold, #d4a853);
}
.ap-btn--ghost:hover:not(:disabled) {
  border-color: var(--color-accent-gold, #d4a853);
  box-shadow: 0 0 16px -2px rgba(212, 168, 83, 0.45);
  background: rgba(212, 168, 83, 0.08);
}

.ap-btn--primary {
  background: linear-gradient(135deg, #d4a853 0%, #b08a3e 100%);
  border: 1px solid #e8c87a;
  color: #1a1206;
  font-weight: 600;
  box-shadow:
    0 0 0 1px rgba(212, 168, 83, 0.35),
    0 8px 20px -6px rgba(212, 168, 83, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ap-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1px rgba(232, 200, 122, 0.6),
    0 14px 26px -6px rgba(212, 168, 83, 0.75),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.ap-btn--primary::before {
  content: ''; position: absolute; top: 0; left: -60%;
  width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  transform: skewX(-20deg);
  transition: left 700ms ease;
}
.ap-btn--primary:hover::before { left: 140%; }

.ap-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(212, 168, 83, 0.25);
  border-top-color: var(--color-accent-gold, #d4a853);
  border-radius: 50%;
  animation: ap-spin 0.8s linear infinite;
  display: inline-block;
}

/* 结果 */
.ap-result {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px;
  padding: 4px 10px 4px 8px;
  border-radius: 2px;
  font-family: var(--font-sans);
  letter-spacing: 0.02em;
}
.ap-result__dot {
  width: 8px; height: 8px; border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}
.ap-result--success { color: #7ad69a; background: rgba(58, 158, 92, 0.12); border: 1px solid rgba(58, 158, 92, 0.35); }
.ap-result--warning { color: #e8c87a; background: rgba(212, 168, 83, 0.1); border: 1px solid rgba(212, 168, 83, 0.35); }
.ap-result--error   { color: #e68a72; background: rgba(212, 90, 58, 0.12); border: 1px solid rgba(212, 90, 58, 0.4); }

/* 过渡 */
.ap-fade-enter-active, .ap-fade-leave-active {
  transition: opacity 260ms ease, transform 260ms ease;
}
.ap-fade-enter-from { opacity: 0; transform: translateY(6px); }
.ap-fade-leave-to   { opacity: 0; transform: translateY(-6px); }

/* ───────── 深度定制 Naive UI 表单控件 ───────── */
.arcanum-pact :deep(.n-base-selection) {
  background: linear-gradient(180deg, rgba(14, 10, 7, 0.85), rgba(28, 21, 14, 0.7)) !important;
  border: 1px solid rgba(212, 168, 83, 0.22) !important;
  border-radius: 2px !important;
  box-shadow: none !important;
  transition: all 220ms ease;
  min-height: 40px !important;
}
.arcanum-pact :deep(.n-base-selection:hover) {
  border-color: rgba(212, 168, 83, 0.45) !important;
}
.arcanum-pact :deep(.n-base-selection--focus) {
  border-color: var(--color-accent-gold, #d4a853) !important;
  box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.12), 0 0 18px -4px rgba(212, 168, 83, 0.45) !important;
}
.arcanum-pact :deep(.n-base-selection__border),
.arcanum-pact :deep(.n-base-selection__state-border) { display: none !important; }
.arcanum-pact :deep(.n-base-selection-label) { color: var(--color-text, #e8e0d0) !important; }

.arcanum-pact :deep(.n-input) {
  background: linear-gradient(180deg, rgba(14, 10, 7, 0.85), rgba(28, 21, 14, 0.7)) !important;
  border: 1px solid rgba(212, 168, 83, 0.22) !important;
  border-radius: 2px !important;
}
.arcanum-pact :deep(.n-input__input-el) { color: var(--color-text, #e8e0d0) !important; }
.arcanum-pact :deep(.n-input--focus) {
  border-color: var(--color-accent-gold, #d4a853) !important;
  box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.12) !important;
}
.arcanum-pact :deep(.n-input__state-border) { display: none !important; }

.arcanum-pact :deep(.n-input-number) { width: 100%; }

.arcanum-pact :deep(.n-slider-rail) {
  background: rgba(255, 255, 255, 0.08) !important;
}
.arcanum-pact :deep(.n-slider-rail__fill) {
  background: linear-gradient(90deg, var(--color-accent-gold, #d4a853), var(--color-accent-gold-light, #e8c87a)) !important;
}
.arcanum-pact :deep(.n-slider-handle) {
  background: var(--color-accent-gold, #d4a853) !important;
  box-shadow: 0 0 12px rgba(212, 168, 83, 0.65) !important;
  border: 1px solid #e8c87a !important;
}

@media (max-width: 560px) {
  .ap-header { padding: 20px 20px 16px; grid-template-columns: auto 1fr auto; gap: 12px; }
  .ap-header__title h2 { font-size: 22px; }
  .ap-tabs { padding: 12px 20px 0; }
  .ap-tab__en { display: none; }
  .ap-body { padding: 18px 20px; }
  .ap-footer { padding: 14px 20px 20px; flex-direction: column; align-items: stretch; }
  .ap-footer__left { align-items: flex-start; }
  .ap-btn { justify-content: center; }
  .ap-row { grid-template-columns: 1fr; gap: 14px; }
  .ap-corner { display: none; }
}
</style>
