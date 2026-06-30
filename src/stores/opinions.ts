import { reactive } from 'vue'
import { defineStore } from 'pinia'

export interface OpinionRound {
  id: number
  label: string
  content: string
  updatedAt: string | null
  updatedBy: string
}

interface OpinionsState {
  rounds: OpinionRound[]
}

const ORDINAL_ZH = ['一','二','三','四','五','六','七','八','九','十']
function mkLabel(n: number) { return `第${ORDINAL_ZH[n - 1] || n}次意见` }

export const useOpinionsStore = defineStore('opinions', () => {
  const state = reactive<OpinionsState>({ rounds: [] })

  async function fetchOpinions() {
    try {
      const res = await fetch('/api/opinions', { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()

      if (Array.isArray(data.rounds)) {
        // 新格式：{ rounds: [...] }
        state.rounds = data.rounds
      } else {
        // 旧格式兼容：{ settings, plot, finalized }（服务器未重启时）
        const rounds: OpinionRound[] = []
        let id = 1
        for (const val of Object.values(data)) {
          if (val && typeof val === 'object') {
            const m = val as Record<string, any>
            rounds.push({
              id,
              label: mkLabel(id),
              content: m.content || '',
              updatedAt: m.updatedAt || null,
              updatedBy: m.updatedBy || ''
            })
            id++
          }
        }
        state.rounds = rounds
      }
    } catch (e) {
      console.error('获取意见数据失败:', e)
    }
  }

  async function saveRound(roundId: number, content: string): Promise<boolean> {
    try {
      const res = await fetch('/api/opinions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, content }),
        credentials: 'same-origin'
      })
      if (res.ok) {
        const body = await res.json()
        // 新格式返回 { round }
        if (body.round) {
          const idx = state.rounds.findIndex(r => r.id === roundId)
          if (idx !== -1) state.rounds[idx] = body.round
        }
        return true
      }
      return false
    } catch (e) {
      console.error('保存意见失败:', e)
      return false
    }
  }

  async function addRound(): Promise<OpinionRound | null> {
    try {
      const res = await fetch('/api/opinions/add-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      })
      if (res.ok) {
        const { round } = await res.json()
        state.rounds.push(round)
        return round
      }
    } catch (e) {
      console.error('新增轮次 API 失败:', e)
    }
    // 降级：服务器未重启时纯前端创建（不持久）
    const maxId = state.rounds.reduce((m, r) => Math.max(m, r.id), 0)
    const newId = maxId + 1
    const newRound: OpinionRound = {
      id: newId, label: mkLabel(newId),
      content: '', updatedAt: null, updatedBy: ''
    }
    state.rounds.push(newRound)
    return newRound
  }

  return { state, fetchOpinions, saveRound, addRound }
})
