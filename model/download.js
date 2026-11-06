/** 下载 B 站视频（无登录，默认 360P），用于直接发送视频文件 */
import https from 'node:https'
import zlib from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseVideoUrl } from './videos.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function getJson (url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false,
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.bilibili.com/',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      }
    }, res => {
      let stream = res
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase()
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate())

      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`B 站接口返回 HTTP ${res.statusCode}`))
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (err) {
          reject(new Error('B 站接口返回的不是合法 JSON'))
        }
      })
      stream.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('B 站接口请求超时')))
    req.on('error', reject)
  })
}

function downloadToFile (url, file, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false,
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.bilibili.com/',
        Accept: '*/*',
        'Accept-Encoding': 'identity'
      }
    }, res => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume()
        return reject(new Error(`视频下载返回 HTTP ${res.statusCode}`))
      }

      const stream = fs.createWriteStream(file)
      let received = 0
      res.on('data', chunk => { received += chunk.length })
      res.pipe(stream)
      stream.on('finish', () => {
        stream.close(() => resolve(received))
      })
      stream.on('error', err => {
        try { fs.unlinkSync(file) } catch (e) { /* ignore */ }
        reject(err)
      })
      res.on('error', err => {
        try { stream.destroy(); fs.unlinkSync(file) } catch (e) { /* ignore */ }
        reject(err)
      })
    })
    req.on('timeout', () => req.destroy(new Error('视频下载超时')))
    req.on('error', reject)
  })
}

/**
 * 下载视频到临时文件
 * @returns {{ file: string, title: string, duration: number, size: number, bvid: string, url: string }}
 */
export async function downloadVideo (rawUrl, options = {}) {
  const video = parseVideoUrl(rawUrl)
  if (!video) throw new Error('没有视频链接')
  if (video.type !== 'bilibili') throw new Error('目前只支持下载 B 站视频')

  const qn = Number(options.qn) || 16
  const maxMB = Number(options.maxMB) || 30

  const view = await getJson(`https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`)
  if (view?.code !== 0 || !view.data) throw new Error(view?.message || '获取视频信息失败')

  const info = view.data
  const cid = info.cid || info.pages?.[0]?.cid
  if (!cid) throw new Error('没有找到视频分 P 信息')

  const play = await getJson(
    `https://api.bilibili.com/x/player/playurl?bvid=${video.bvid}&cid=${cid}&qn=${qn}&fnval=1&fourk=0`
  )
  if (play?.code !== 0 || !play.data?.durl?.length) {
    throw new Error(play?.message || '获取视频播放地址失败')
  }

  const durl = play.data.durl[0]
  const size = Number(durl.size) || 0
  if (size && size > maxMB * 1024 * 1024) {
    throw new Error(`视频约 ${(size / 1048576).toFixed(1)}MB，超过 ${maxMB}MB 限制，可在配置里调大 videoMaxMB`)
  }

  const file = path.join(os.tmpdir(), `mhydps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`)
  const received = await downloadToFile(durl.url, file)

  return {
    file,
    title: String(info.title || ''),
    duration: Number(info.duration) || 0,
    size: received,
    bvid: video.bvid,
    url: video.url
  }
}

/** 发送后延迟删除临时文件 */
export function cleanupFile (file, delay = 120000) {
  const timer = setTimeout(() => {
    fs.unlink(file, () => {})
  }, delay)
  timer.unref?.()
}
