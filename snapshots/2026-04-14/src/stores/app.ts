import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const lastSavedAt = ref<string>('')

  function updateSaveTimestamp() {
    lastSavedAt.value = new Date().toLocaleString('zh-CN')
  }

  return { lastSavedAt, updateSaveTimestamp }
})
