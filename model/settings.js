/** 运行时可调设置（优先存 Redis，重启后仍生效；没有 Redis 时仅本次运行生效） */
const KEY = 'mhydps:settings'

let cache = null
let loading = null

function redisClient () {
  return globalThis.redis || null
}

export async function loadSettings () {
  if (cache) return cache
  if (loading) return loading

  loading = (async () => {
    let data = {}
    try {
      const raw = await redisClient()?.get(KEY)
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (parsed && typeof parsed === 'object') data = parsed
      }
    } catch (err) { /* Redis 不可用时用内存 */ }
    cache = data
    return cache
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

export function getSetting (key, fallback) {
  if (!cache) return fallback
  return cache[key] ?? fallback
}

/** 返回 false 表示只写进了内存（Redis 不可用） */
export async function setSetting (key, value) {
  await loadSettings()
  if (value === null || value === undefined) delete cache[key]
  else cache[key] = value

  try {
    const redis = redisClient()
    if (!redis) return false
    await redis.set(KEY, JSON.stringify(cache))
    return true
  } catch (err) {
    return false
  }
}

/** 取渲染倍率（1 ~ 3） */
export function getRenderScale (fallback = 2) {
  const value = Number(getSetting('scale', fallback))
  if (!Number.isFinite(value)) return fallback
  return Math.min(3, Math.max(1, value))
}
