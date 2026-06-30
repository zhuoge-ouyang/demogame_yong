<script setup lang="ts">
import { ref } from 'vue'

const iframeLoaded = ref(false)

function handleLoad() {
  iframeLoaded.value = true
}
</script>

<template>
  <div class="preview-page">
    <div class="preview-header">
      <h2>世界观预览</h2>
      <p class="preview-desc">基于世界观数据生成的可视化报告文档</p>
    </div>
    <div class="preview-container">
      <div v-if="!iframeLoaded" class="loading-state">
        加载中...
      </div>
      <iframe
        src="/世界观报告.html"
        class="preview-frame"
        @load="handleLoad"
        frameborder="0"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
}

.preview-header {
  padding: 16px 24px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.preview-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-accent-gold);
  margin: 0 0 4px;
  font-family: var(--font-display);
}

.preview-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.preview-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.loading-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-text-tertiary);
  font-size: 14px;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
