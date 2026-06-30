<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NAlert, NTabs, NTabPane, NSpace } from 'naive-ui'
import { useAssessmentStore } from '@/stores/assessment'
import { testConnection } from '@/services/assessment-evaluator'
import type { EvalProvider, AnalysisProvider } from '@/types/assessment'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const assessmentStore = useAssessmentStore()

// 测试连接状态
interface TestStatus {
  loading: boolean
  result: 'success' | 'error' | null
  message: string
}

const testStatuses = ref<Record<EvalProvider | AnalysisProvider, TestStatus>>({
  qwen: { loading: false, result: null, message: '' },
  doubao: { loading: false, result: null, message: '' },
  minimax: { loading: false, result: null, message: '' },
  kimi: { loading: false, result: null, message: '' }
})

// 获取各模型配置
const qwenConfig = computed(() => assessmentStore.evalConfigs[0])
const doubaoConfig = computed(() => assessmentStore.evalConfigs[1])
const minimaxConfig = computed(() => assessmentStore.evalConfigs[2])
const kimiConfig = computed(() => assessmentStore.kimiConfig)

// 更新配置方法
function updateQwenConfig(partial: Partial<typeof qwenConfig.value>) {
  assessmentStore.updateEvalConfig(0, partial)
}

function updateDoubaoConfig(partial: Partial<typeof doubaoConfig.value>) {
  assessmentStore.updateEvalConfig(1, partial)
}

function updateMinimaxConfig(partial: Partial<typeof minimaxConfig.value>) {
  assessmentStore.updateEvalConfig(2, partial)
}

function updateKimiConfig(partial: Partial<typeof kimiConfig.value>) {
  assessmentStore.updateKimiConfig(partial)
}

// 测试连接
async function handleTestConnection(provider: EvalProvider | AnalysisProvider) {
  const status = testStatuses.value[provider]
  status.loading = true
  status.result = null
  status.message = ''

  try {
    let config
    switch (provider) {
      case 'qwen':
        config = qwenConfig.value
        break
      case 'doubao':
        config = doubaoConfig.value
        break
      case 'minimax':
        config = minimaxConfig.value
        break
      case 'kimi':
        config = kimiConfig.value
        break
    }

    const result = await testConnection(config)
    status.result = result.success ? 'success' : 'error'
    status.message = result.message
  } catch (error) {
    status.result = 'error'
    status.message = error instanceof Error ? error.message : '连接测试失败'
  } finally {
    status.loading = false
  }
}

function handleClose() {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="(v: boolean) => emit('update:show', v)"
    preset="card"
    title="评测模型配置"
    style="max-width: 600px;"
  >
    <NTabs type="line" animated>
      <!-- Qwen3.6-Plus -->
      <NTabPane name="qwen" tab="Qwen3.6-Plus">
        <NForm label-placement="left" label-width="100">
          <NFormItem label="API Key">
            <NInput
              :value="qwenConfig?.apiKey || ''"
              type="password"
              show-password-on="click"
              placeholder="输入阿里云 DashScope API Key"
              @update:value="(v: string) => updateQwenConfig({ apiKey: v })"
            />
          </NFormItem>
          <NFormItem label="接口地址">
            <NInput
              :value="qwenConfig?.baseUrl || ''"
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              @update:value="(v: string) => updateQwenConfig({ baseUrl: v })"
            />
          </NFormItem>
          <NFormItem label="模型名称">
            <NInput
              :value="qwenConfig?.model || ''"
              placeholder="qwen3.6-plus"
              @update:value="(v: string) => updateQwenConfig({ model: v })"
            />
          </NFormItem>
        </NForm>
        <NSpace vertical size="small">
          <NButton
            size="small"
            :loading="testStatuses.qwen.loading"
            @click="handleTestConnection('qwen')"
          >
            测试连接
          </NButton>
          <NAlert
            v-if="testStatuses.qwen.result"
            :type="testStatuses.qwen.result"
            size="small"
          >
            {{ testStatuses.qwen.message }}
          </NAlert>
        </NSpace>
      </NTabPane>

      <!-- 豆包 -->
      <NTabPane name="doubao" tab="豆包">
        <NAlert type="info" size="small" style="margin-bottom: 16px;">
          豆包模型需要在火山引擎控制台获取Endpoint ID
        </NAlert>
        <NForm label-placement="left" label-width="100">
          <NFormItem label="API Key">
            <NInput
              :value="doubaoConfig?.apiKey || ''"
              type="password"
              show-password-on="click"
              placeholder="输入火山引擎 API Key"
              @update:value="(v: string) => updateDoubaoConfig({ apiKey: v })"
            />
          </NFormItem>
          <NFormItem label="接口地址">
            <NInput
              :value="doubaoConfig?.baseUrl || ''"
              placeholder="https://ark.cn-beijing.volces.com/api/v3"
              @update:value="(v: string) => updateDoubaoConfig({ baseUrl: v })"
            />
          </NFormItem>
          <NFormItem label="模型名称">
            <NInput
              :value="doubaoConfig?.model || ''"
              placeholder="doubao-pro"
              @update:value="(v: string) => updateDoubaoConfig({ model: v })"
            />
          </NFormItem>
          <NFormItem label="Endpoint ID">
            <NInput
              :value="doubaoConfig?.endpoint || ''"
              placeholder="输入Endpoint ID"
              @update:value="(v: string) => updateDoubaoConfig({ endpoint: v })"
            />
          </NFormItem>
        </NForm>
        <NSpace vertical size="small">
          <NButton
            size="small"
            :loading="testStatuses.doubao.loading"
            @click="handleTestConnection('doubao')"
          >
            测试连接
          </NButton>
          <NAlert
            v-if="testStatuses.doubao.result"
            :type="testStatuses.doubao.result"
            size="small"
          >
            {{ testStatuses.doubao.message }}
          </NAlert>
        </NSpace>
      </NTabPane>

      <!-- Minimax -->
      <NTabPane name="minimax" tab="Minimax">
        <NForm label-placement="left" label-width="100">
          <NFormItem label="API Key">
            <NInput
              :value="minimaxConfig?.apiKey || ''"
              type="password"
              show-password-on="click"
              placeholder="输入 MiniMax API Key"
              @update:value="(v: string) => updateMinimaxConfig({ apiKey: v })"
            />
          </NFormItem>
          <NFormItem label="接口地址">
            <NInput
              :value="minimaxConfig?.baseUrl || ''"
              placeholder="https://api.minimax.chat/v1"
              @update:value="(v: string) => updateMinimaxConfig({ baseUrl: v })"
            />
          </NFormItem>
          <NFormItem label="模型名称">
            <NInput
              :value="minimaxConfig?.model || ''"
              placeholder="MiniMax-Text-01"
              @update:value="(v: string) => updateMinimaxConfig({ model: v })"
            />
          </NFormItem>
        </NForm>
        <NSpace vertical size="small">
          <NButton
            size="small"
            :loading="testStatuses.minimax.loading"
            @click="handleTestConnection('minimax')"
          >
            测试连接
          </NButton>
          <NAlert
            v-if="testStatuses.minimax.result"
            :type="testStatuses.minimax.result"
            size="small"
          >
            {{ testStatuses.minimax.message }}
          </NAlert>
        </NSpace>
      </NTabPane>

      <!-- Kimi 2.5 -->
      <NTabPane name="kimi" tab="Kimi 2.5">
        <NAlert type="info" size="small" style="margin-bottom: 16px;">
          Kimi 2.5 用于低分深度分析，API Key 请在 platform.moonshot.cn 获取
        </NAlert>
        <NForm label-placement="left" label-width="100">
          <NFormItem label="API Key">
            <NInput
              :value="kimiConfig?.apiKey || ''"
              type="password"
              show-password-on="click"
              placeholder="输入 Moonshot API Key"
              @update:value="(v: string) => updateKimiConfig({ apiKey: v })"
            />
          </NFormItem>
          <NFormItem label="接口地址">
            <NInput
              :value="kimiConfig?.baseUrl || ''"
              placeholder="https://api.moonshot.cn/v1"
              @update:value="(v: string) => updateKimiConfig({ baseUrl: v })"
            />
          </NFormItem>
          <NFormItem label="模型名称">
            <NInput
              :value="kimiConfig?.model || ''"
              placeholder="kimi-k2.5"
              @update:value="(v: string) => updateKimiConfig({ model: v })"
            />
          </NFormItem>
        </NForm>
        <NSpace vertical size="small">
          <NButton
            size="small"
            :loading="testStatuses.kimi.loading"
            @click="handleTestConnection('kimi')"
          >
            测试连接
          </NButton>
          <NAlert
            v-if="testStatuses.kimi.result"
            :type="testStatuses.kimi.result"
            size="small"
          >
            {{ testStatuses.kimi.message }}
          </NAlert>
        </NSpace>
      </NTabPane>
    </NTabs>

    <template #footer>
      <div style="text-align: right;">
        <NButton type="primary" @click="handleClose">确定</NButton>
      </div>
    </template>
  </NModal>
</template>
