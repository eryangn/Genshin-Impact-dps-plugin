/** 武器数据：ID → 中文名 / 星级 / 类型；图标来自 Enka 公共资源（带缓存） */
import https from 'node:https'
import { WEAPONS } from './weapon-data.js'

const META = new Map()
for (const [id, name, rank, type, icon] of WEAPONS) {
  META.set(Number(id), { id: Number(id), name, rank, type, icon })
}

/** 按 itemId 取武器信息（找不到返回 null） */
export function weaponInfo (id) {
  return META.get(Number(id)) || null
}

const CACHE_TTL = 24 * 60 * 60 * 1000
const iconCache = new Map()
const iconPending = new Map()

function fetchPng (url, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Yunzai-mhydps-plugin/1.6)',
        Accept: 'image/png,image/*',
        'Accept-Encoding': 'identity'
      }
    }, res => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`武器图标返回 HTTP ${res.statusCode}`))
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('武器图标请求超时')))
    req.on('error', reject)
  })
}

/** 武器图标 → data URI；失败返回 null */
export async function getWeaponIcon (iconName) {
  const key = String(iconName || '').trim()
  if (!key) return null

  const hit = iconCache.get(key)
  if (hit) {
    const ttl = hit.uri ? CACHE_TTL : 10 * 60 * 1000
    if (Date.now() - hit.at < ttl) return hit.uri || null
  }
  if (iconPending.has(key)) return iconPending.get(key)

  const task = fetchPng(`https://enka.network/ui/${key}.png`)
    .then(buffer => {
      const uri = `data:image/png;base64,${buffer.toString('base64')}`
      iconCache.set(key, { uri, at: Date.now() })
      return uri
    })
    .catch(() => {
      iconCache.set(key, { failed: true, at: Date.now() })
      return null
    })
    .finally(() => iconPending.delete(key))

  iconPending.set(key, task)
  return task
}

/** 批量取图标（并发 4），超时返回已完成部分 */
export async function prefetchWeaponIcons (iconNames, timeout = 6000) {
  const unique = [...new Set((iconNames || []).filter(Boolean))]
  const result = new Map()
  if (!unique.length) return result

  let cursor = 0
  const worker = async () => {
    while (cursor < unique.length) {
      const name = unique[cursor++]
      const uri = await getWeaponIcon(name)
      if (uri) result.set(name, uri)
    }
  }
  const task = Promise.allSettled(Array.from({ length: Math.min(4, unique.length) }, worker))

  await Promise.race([
    task,
    new Promise(resolve => {
      const timer = setTimeout(resolve, Math.max(1000, timeout))
      timer.unref?.()
    })
  ])
  return result
}
