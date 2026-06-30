/**
 * 数据 API 服务层
 * 负责前端与后端通信，实现共享数据的读写
 * 开发模式通过 Vite proxy 代理，生产模式直接访问同源服务器
 */

const API_BASE = ''  // 使用相对路径，开发模式通过 Vite proxy，生产模式同源

function getErrorMessage(err: any, fallback: string): string {
  return err?.message || err?.error || fallback
}

export async function fetchData<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api/data/${key}`, { credentials: 'same-origin' })
    const json = await res.json()
    return json.success ? json.data : null
  } catch (error) {
    console.warn(`从服务器获取 ${key} 数据失败，将使用本地缓存`, error)
    return null
  }
}

export async function saveData(key: string, data: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/data/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin',
    })
    const json = await res.json()
    return json.success
  } catch (error) {
    console.warn(`保存 ${key} 数据到服务器失败，已保存到本地`, error)
    return false
  }
}

export async function syncReference(
  realm: string,
  field: string,
  content: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/sync-reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ realm, field, content }),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '同步失败' }))
    throw new Error(getErrorMessage(err, '同步失败'))
  }
  return res.json()
}

export async function syncModuleReference(
  module: string,
  field: string,
  content: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/sync-reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module, field, content }),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '同步失败' }))
    throw new Error(getErrorMessage(err, '同步失败'))
  }
  return res.json()
}

export async function syncModuleReferenceBatch(
  module: string,
  fields: Record<string, string>
): Promise<{ success: boolean; updated?: string[] }> {
  const res = await fetch(`${API_BASE}/api/sync-reference/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module, fields }),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '批量同步失败' }))
    throw new Error(getErrorMessage(err, '批量同步失败'))
  }
  return res.json()
}

export async function syncReferenceBatch(
  realm: string,
  fields: { past?: string; present?: string; future?: string }
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/sync-reference/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ realm, fields }),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '批量同步失败' }))
    throw new Error(getErrorMessage(err, '批量同步失败'))
  }
  return res.json()
}

export async function fetchAllData(): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/api/data`, { credentials: 'same-origin' })
    const json = await res.json()
    return json.success ? json.data : null
  } catch (error) {
    console.warn('从服务器批量获取数据失败', error)
    return null
  }
}
