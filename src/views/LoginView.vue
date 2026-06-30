<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const message = useMessage()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  if (!username.value.trim()) {
    errorMessage.value = '请输入用户名'
    return
  }
  if (!password.value) {
    errorMessage.value = '请输入密码'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await authStore.login(username.value.trim(), password.value)
    if (result.success) {
      message.success('登录成功')
      router.push('/')
    } else {
      errorMessage.value = result.message || '登录失败'
    }
  } catch (e) {
    errorMessage.value = '登录发生错误'
  } finally {
    loading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !loading.value) {
    handleLogin()
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-background" aria-hidden="true"></div>
    <div class="login-copy">
      <span>WORLD FORGE ACCESS</span>
      <h1>魂域神话生成台</h1>
      <p>进入世界树根系，继续锻造三界、九大陆与英雄战役。</p>
    </div>
    <NCard class="login-card" title="登录工作台" :bordered="true">
      <NForm @submit.prevent="handleLogin">
        <NFormItem label="用户名">
          <NInput
            v-model:value="username"
            placeholder="请输入用户名"
            size="large"
            :disabled="loading"
            @keydown="handleKeydown"
          />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            size="large"
            :disabled="loading"
            @keydown="handleKeydown"
          />
        </NFormItem>
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
        <NSpace vertical :size="16" class="login-actions">
          <NButton
            type="primary"
            size="large"
            block
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 420px;
  gap: clamp(28px, 6vw, 80px);
  align-items: center;
  justify-content: center;
  position: relative;
  padding: clamp(22px, 6vw, 76px);
  background: #080807;
  overflow: hidden;
}

.login-background {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(212, 168, 83, 0.08) 0%, transparent 70%);
  background:
    linear-gradient(90deg, rgba(8, 8, 7, 0.92), rgba(8, 8, 7, 0.42), rgba(8, 8, 7, 0.86)),
    url('/images/generated/world-forge-cinematic.png') center / cover no-repeat;
  pointer-events: none;
}

.login-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--epic-canvas-noise);
  opacity: 0.22;
  mix-blend-mode: soft-light;
}

.login-copy {
  position: relative;
  z-index: 1;
  max-width: 760px;
}

.login-copy span {
  display: block;
  color: rgba(248, 207, 122, 0.78);
  font-family: var(--font-display-epic);
  font-size: 12px;
  letter-spacing: 0.36em;
  margin-bottom: 18px;
}

.login-copy h1 {
  margin: 0;
  color: #f2dfb6;
  font-family: var(--font-display-epic);
  font-size: clamp(42px, 7vw, 88px);
  line-height: 1;
  letter-spacing: 0.08em;
  text-shadow: 0 4px 28px rgba(0, 0, 0, 0.9);
}

.login-copy p {
  max-width: 540px;
  margin-top: 22px;
  color: rgba(236, 224, 198, 0.82);
  font-size: 17px;
  line-height: 1.8;
}

.login-card {
  width: 400px;
  max-width: 90vw;
  position: relative;
  z-index: 1;
  background:
    linear-gradient(180deg, rgba(20, 18, 15, 0.86), rgba(8, 8, 7, 0.94)) !important;
  border-color: rgba(236, 204, 142, 0.22) !important;
  border-radius: 0 !important;
  box-shadow: 0 34px 90px -46px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 240, 200, 0.08) !important;
  backdrop-filter: blur(14px);
}

.login-card :deep(.n-card-header) {
  padding: 20px 24px 0;
}

.login-card :deep(.n-card-header .n-card-header__main) {
  font-size: 22px;
  font-weight: 600;
  color: #f2dfb6;
  text-align: center;
  font-family: var(--font-display-epic, inherit);
  letter-spacing: 0.12em;
}

.login-card :deep(.n-card__content) {
  padding: 20px 24px 24px;
}

.login-card :deep(.n-form-item-label) {
  color: #9b8e7e;
}

.error-message {
  color: #d45a3a;
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}

.login-actions {
  margin-top: 8px;
}

@media (max-width: 900px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .login-card {
    width: min(420px, 100%);
  }
}
</style>
