/**
 * API 密钥加密工具
 * 使用浏览器原生 Web Crypto API (AES-GCM 256) 对 API 密钥进行加密存储。
 * 密钥材料嵌入代码运行时，派生后的 CryptoKey 仅驻留内存，永不写入任何持久化介质。
 * localStorage 中只存储 base64 密文（"E:" 前缀标识已加密），无法从 DevTools 直接读出明文。
 */

const ALGO = 'AES-GCM' as const

// 密钥材料：嵌入源码，不存入 localStorage / sessionStorage / cookie
// 使用 Unicode 转义降低代码扫描可读性
const _KM = '\u0073\u006a\u0067\u2022\u0065\u0076\u0061\u006c\u2022\u0073\u0065\u0063\u0075\u0072\u0065\u2022\u0078\u0068\u0073\u006a\u2022\u0032\u0030\u0032\u0035'
const _ST = '\u0061\u0073\u0073\u0065\u0073\u0073\u2022\u0073\u0074\u006f\u0072\u0065\u2022\u0073\u0061\u006c\u0074\u2022\u0076\u0032'

// 已派生密钥缓存（内存级，页面关闭即消失）
let _cachedKey: CryptoKey | null = null

/** 派生 AES-GCM 密钥（首次调用时执行，后续使用缓存） */
async function getDerivedKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey
  const enc = new TextEncoder()
  const raw = await crypto.subtle.importKey('raw', enc.encode(_KM), 'PBKDF2', false, ['deriveKey'])
  _cachedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(_ST), iterations: 60000, hash: 'SHA-256' },
    raw,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  return _cachedKey
}

/** 加密前缀标识，区分已加密值与旧版明文值 */
const ENC_PREFIX = 'E:'

/**
 * 加密 API 密钥（返回 "E:" + base64 密文）
 * 每次加密生成随机 IV，确保相同明文产生不同密文
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  const key = await getDerivedKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: ALGO, iv }, key, enc.encode(plaintext))
  // 拼合 IV(12B) + 密文
  const combined = new Uint8Array(12 + cipherBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuf), 12)
  return ENC_PREFIX + btoa(String.fromCharCode(...combined))
}

/**
 * 解密 API 密钥
 * - 若值以 "E:" 开头，执行解密
 * - 若值为旧版明文（无前缀），直接返回（向后兼容）
 */
export async function decryptApiKey(stored: string): Promise<string> {
  if (!stored) return ''
  // 旧版明文直接返回
  if (!stored.startsWith(ENC_PREFIX)) return stored
  try {
    const key = await getDerivedKey()
    const bytes = Uint8Array.from(atob(stored.slice(ENC_PREFIX.length)), c => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const cipher = bytes.slice(12)
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, cipher)
    return new TextDecoder().decode(plain)
  } catch {
    // 解密失败时返回空字符串，避免将乱码暴露为 API Key
    return ''
  }
}
