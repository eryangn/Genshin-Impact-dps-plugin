/** 角色头像：站点 /charactor/<id>.webp，转成 data URI 后内嵌进卡片，避免渲染时依赖外网 */
import https from 'node:https'
import { characterId } from './characters.js'

const SITE = 'https://www.mhydps.cn'
const CACHE_TTL = 24 * 60 * 60 * 1000

const cache = new Map()
const pending = new Map()

function fetchWebp (url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false,
      headers: {
        Referer: `${SITE}/`,
        'User-Agent': 'Mozilla/5.0 (compatible; Yunzai-mhydps-plugin/1.2)',
        'Accept-Encoding': 'identity'
      }
    }, res => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`头像返回 HTTP ${res.statusCode}`))
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })

    req.on('timeout', () => req.destroy(new Error('头像请求超时')))
    req.on('error', reject)
  })
}

/** 取头像 data URI；失败返回 null（10 分钟内不重复尝试） */
export async function getAvatar (name) {
  const key = String(name || '').trim()
  if (!key) return null

  const hit = cache.get(key)
  if (hit) {
    const ttl = hit.uri ? CACHE_TTL : 10 * 60 * 1000
    if (Date.now() - hit.at < ttl) return hit.uri || null
  }

  if (pending.has(key)) return pending.get(key)

  const id = characterId(key)
  if (!id) return null

  const task = fetchWebp(`${SITE}/charactor/${id}.webp`)
    .then(buffer => {
      const uri = `data:image/webp;base64,${buffer.toString('base64')}`
      cache.set(key, { uri, at: Date.now() })
      return uri
    })
    .catch(() => {
      cache.set(key, { failed: true, at: Date.now() })
      return null
    })
    .finally(() => pending.delete(key))

  pending.set(key, task)
  return task
}

/** 批量获取，超时后返回已完成的部分（不阻塞渲染太久） */
/** 限制并发，避免一次性向站点请求几十张头像 */
async function mapLimit (items, limit, worker) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index])
    }
  })
  await Promise.allSettled(runners)
}

/** 批量获取，超时后返回已完成的部分（不阻塞渲染太久） */
export async function prefetchAvatars (names, timeout = 8000) {
  const unique = [...new Set((names || []).filter(Boolean))]
  const result = new Map()
  if (!unique.length) return result

  const task = mapLimit(unique, 6, async name => {
    const uri = await getAvatar(name)
    if (uri) result.set(name, uri)
  })

  await Promise.race([
    task,
    new Promise(resolve => {
      const timer = setTimeout(resolve, Math.max(1000, timeout))
      timer.unref?.()
    })
  ])

  return result
}

/** 清理过期头像 */
export function clearAvatarCache () {
  cache.clear()
  pending.clear()
}
