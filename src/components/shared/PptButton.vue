<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NTooltip, NModal, NSpace } from 'naive-ui'

/** 传入文件名则预览对应PPT/PDF，不传则显示"制作中……"提示 */
const props = withDefaults(defineProps<{ pptFile?: string }>(), { pptFile: '' })

const showModal = ref(false)
const viewerUrl = ref('')

/** 文件访问路径 */
const filePath = computed(() =>
  props.pptFile ? '/docx/' + encodeURIComponent(props.pptFile) : ''
)

/** 是否为 PDF（直接本地加载，无需外网） */
const isPdf = computed(() => /\.pdf$/i.test(props.pptFile))

/** 标题（取文件名去掉后缀） */
const pptTitle = computed(() =>
  props.pptFile ? props.pptFile.replace(/\.(pptx?|pdf)$/i, '') : ''
)

function getViewerUrl(): string {
  if (isPdf.value) {
    // PDF：直接走本地路径，浏览器原生渲染，无需外网
    // #view=FitH 强制浏览器 PDF 查看器适合宽度显示，避免水平滚动
    return filePath.value + '#view=FitH'
  }
  // PPTX：使用 Office Online（需要公网可达）
  const fileUrl = window.location.origin + filePath.value
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
}

function openPpt() {
  if (props.pptFile && !viewerUrl.value) {
    // 首次打开才赋值，避免重复加载
    viewerUrl.value = getViewerUrl()
  }
  showModal.value = true
}

function downloadPpt() {
  window.open(filePath.value, '_blank')
}
</script>

<template>
  <div class="ppt-btn-wrap">
    <NTooltip trigger="hover" placement="top">
      <template #trigger>
        <NButton
          size="tiny"
          type="primary"
          ghost
          style="font-size:11px;padding:0 8px;white-space:nowrap;"
          @click="openPpt"
        >
          观看片册
        </NButton>
      </template>
      {{ pptFile ? (isPdf ? '本地预览演示文稿' : '在网页内预览演示文稿') : '演示文稿制作中' }}
    </NTooltip>

    <!-- 弹窗：有文件=预览，无文件="制作中" -->
    <NModal
      v-model:show="showModal"
      :mask-closable="true"
      style="width:95vw;max-width:1400px;"
    >
      <div class="ppt-modal">
        <div class="ppt-modal-header">
          <span class="ppt-modal-title">
            {{ pptFile ? pptTitle : '演示文稿制作中' }}
          </span>
          <NSpace>
            <NButton v-if="pptFile" size="small" ghost @click="downloadPpt">
              {{ isPdf ? '下载 PDF' : '下载 PPTX' }}
            </NButton>
            <NButton size="small" @click="showModal = false">关闭</NButton>
          </NSpace>
        </div>
        <div class="ppt-modal-body">
          <!-- 有文件：PDF本地预览 或 Office Online -->
          <iframe
            v-if="pptFile"
            :src="viewerUrl"
            class="ppt-iframe"
            frameborder="0"
            allowfullscreen
          />
          <!-- 无文件：制作中提示 -->
          <div v-else class="ppt-wip">
            <div class="ppt-wip-text">制作中……</div>
            <div class="ppt-wip-sub">该演示文稿尚未制作完成，敬请期待</div>
          </div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.ppt-btn-wrap {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.ppt-modal {
  background: linear-gradient(180deg, rgba(26, 20, 14, 0.98) 0%, rgba(18, 13, 9, 0.99) 100%);
  border-radius: 4px;
  border: 1px solid rgba(212, 168, 83, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 90vh;
  box-shadow: 0 20px 60px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.4);
}

.ppt-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(40, 28, 16, 0.9), rgba(24, 17, 11, 0.95));
  border-bottom: 1px solid rgba(212, 168, 83, 0.28);
  flex-shrink: 0;
}

.ppt-modal-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0c882;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ppt-modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ppt-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  align-self: stretch;
}

.ppt-wip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255,255,255,0.6);
}

.ppt-wip-icon {
  font-size: 56px;
  line-height: 1;
}

.ppt-wip-text {
  font-size: 22px;
  font-weight: 600;
  color: #e0c882;
  letter-spacing: 2px;
}

.ppt-wip-sub {
  font-size: 13px;
  color: rgba(255,255,255,0.45);
}
</style>
