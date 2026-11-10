/** 配队视频：解析 B 站链接并拉取标题 / 封面 / 时长（带缓存） */
import https from 'node:https'
import zlib from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { config } from '../config/config.js'

const CACHE_TTL = 60 * 60 * 1000
const cache = new Map()
const pending = new Map()

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// B 站接口对纯 IP 请求会返回 412：始终附带 buvid3，填了 biliCookie 再叠加登录态
const BILI_COOKIE = [
  String(config.biliCookie || '').trim(),
  `buvid3=${randomUUID()}infoc`,
  `b_nut=${Math.floor(Date.now() / 1000)}`
].filter(Boolean).join('; ')

/** 解析站点里的 video_url */
export function parseVideoUrl (raw) {
  const url = String(raw || '').trim()
  if (!url) return null
  const matched = url.match(/BV[0-9A-Za-z]+/)
  if (matched) {
    return {
      type: 'bilibili',
      bvid: matched[0],
      url: `https://www.bilibili.com/video/${matched[0]}`
    }
  }
  return { type: 'other', bvid: '', url }
}

function request (url, { json = false, timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false,
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.bilibili.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Cookie: BILI_COOKIE,
        Accept: json ? 'application/json' : 'image/webp,image/jpeg,image/*',
        'Accept-Encoding': json ? 'gzip, deflate' : 'identity'
      }
    }, res => {
      let stream = res
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase()
      if (json && encoding === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (json && encoding === 'deflate') stream = res.pipe(zlib.createInflate())

      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`视频接口返回 HTTP ${res.statusCode}`))
        }
        const buffer = Buffer.concat(chunks)
        if (!json) return resolve(buffer)
        try {
          resolve(JSON.parse(buffer.toString('utf8')))
        } catch (err) {
          reject(new Error('视频接口返回的不是合法 JSON'))
        }
      })
      stream.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('视频接口请求超时')))
    req.on('error', reject)
  })
}

/** 封面裁成 480x270 webp，避免拉 1MB+ 原图 */
function thumbUrl (pic) {
  const url = String(pic || '').replace(/^http:/, 'https:')
  if (!url) return ''
  return url.includes('@') ? url : `${url}@480w_270h_1c.webp`
}

async function fetchBilibili (video) {
  const api = `https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`
  const result = {
    title: '',
    cover: '',
    duration: 0,
    author: '',
    url: video.url,
    bvid: video.bvid,
    type: 'bilibili'
  }

  try {
    const data = await request(api, { json: true })
    if (data?.code === 0 && data.data) {
      const info = data.data
      result.title = String(info.title || '')
      result.duration = Number(info.duration) || 0
      result.author = String(info?.owner?.name || '')
      const pic = thumbUrl(info.pic)
      if (pic) {
        try {
          const buffer = await request(pic, { timeout: 10000 })
          result.cover = `data:image/webp;base64,${buffer.toString('base64')}`
        } catch (err) { /* 封面失败不影响文字信息 */ }
      }
    }
  } catch (err) { /* 接口失败时只保留链接 */ }

  return result
}

/** 取单条视频信息（1 小时缓存） */
export async function getVideo (rawUrl) {
  const video = parseVideoUrl(rawUrl)
  if (!video) return null
  const key = video.url

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data
  if (pending.has(key)) return pending.get(key)

  const task = (video.type === 'bilibili' ? fetchBilibili(video) : Promise.resolve({
    title: '',
    cover: '',
    duration: 0,
    author: '',
    url: video.url,
    bvid: '',
    type: 'other'
  }))
    .then(data => {
      cache.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => pending.delete(key))

  pending.set(key, task)
  return task
}

/** 批量取视频信息，超时返回已完成部分 */
export async function prefetchVideos (urls, timeout = 9000) {
  const unique = [...new Set((urls || []).filter(Boolean))]
  const result = new Map()
  if (!unique.length) return result

  let cursor = 0
  const worker = async () => {
    while (cursor < unique.length) {
      const url = unique[cursor++]
      try {
        const data = await getVideo(url)
        if (data) result.set(url, data)
      } catch (err) { /* 单条失败忽略 */ }
    }
  }
  const task = Promise.allSettled(Array.from({ length: Math.min(3, unique.length) }, worker))

  await Promise.race([
    task,
    new Promise(resolve => {
      const timer = setTimeout(resolve, Math.max(1000, timeout))
      timer.unref?.()
    })
  ])
  return result
}

export function formatDuration (seconds) {
  const total = Number(seconds) || 0
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
