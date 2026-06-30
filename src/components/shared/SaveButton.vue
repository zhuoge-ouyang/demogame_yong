<script setup lang="ts">
import { ref } from 'vue'
import { NButton, useMessage } from 'naive-ui'

const props = defineProps<{
  saveHandler: () => Promise<void>
}>()

const saving = ref(false)
const message = useMessage()

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    await props.saveHandler()
    message.success('保存成功，数据已同步到服务器')
  } catch (e) {
    message.error('保存失败，请重试')
    console.error('[SaveButton] 保存失败:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NButton 
    type="primary" 
    :loading="saving" 
    @click="handleSave"
    size="small"
  >
    {{ saving ? '保存中' : '保存' }}
  </NButton>
</template>
