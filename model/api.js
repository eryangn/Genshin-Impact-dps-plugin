/**
 * mhydps.cn 数据接口
 *
 * 首选站点自带的只读接口（与网页同源，国内可直连、无需密钥）：
 *   https://www.mhydps.cn/api/teams    全部 DPS 配队
 *   https://www.mhydps.cn/api/teams2   危战竞速
 *
 * 站点接口异常时，回退到站点背后的 Supabase 公开只读接口。
 *
 * teams 字段：
 *   members     队伍成员 [{ charId: 角色名, constellation: 命座 }]
 *   damage      站点口径的 DPS（页面直接展示该值）
 *   cost        总金数（限定金 + 常驻金）
 *   limitcost   限定金数量
 *   normalcost  常驻金数量
 *   tags        标签（绿玩、宏、比赛等）
 *   video_url   参考视频
 *   clean       是否绿玩
 *   lvl         是否含命星
 *   confirm     是否已审核
 *
 * teams2 字段：speed 为通关用时（秒，越小越好）
 */
import https from 'node:https'
import zlib from 'node:zlib'
import { config } from '../config/config.js'

export const SITE_URL = 'https://www.mhydps.cn'
const SITE_API = `${SITE_URL}/api`
const SUPABASE_URL = 'https://wkmmxklimjypeyaczsxs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_pDub4laNxQJ2--fVzf7Dmw_At107X9p'

const TEAM_FIELDS = [
  'id', 'members', 'damage', 'cost', 'limitcost', 'normalcost',
  'tags', 'video_url', 'clean', 'lvl', 'confirm'
].join(',')

const STYGIAN_FIELDS = [
  'id', 'members', 'cost', 'limitcost', 'normalcost',
  'confirm', 'video_url', 'speed', 'ver', 'boss', 'lvl'
].join(',')

/** 带超时 / 重试的 HTTPS GET，返回解析后的 JSON */
function getJson (url, headers = {}) {
  const timeout = Math.max(3000, Number(config.timeout) || 20000)
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false, // 不复用连接，避免 Cloudflare 断开的 keep-alive 连接触发 ECONNRESET
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'Mozilla/5.0 (compatible; Yunzai-mhydps-plugin/1.0)',
        ...headers
      }
    }, res => {
      let stream = res
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase()
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate())
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress())

      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').trim()
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`接口返回 HTTP ${res.statusCode}`))
        }
        if (!body || body.startsWith('<')) {
          return reject(new Error('接口返回了网页内容（可能被 Cloudflare 拦截）'))
        }
        try {
          resolve(JSON.parse(body))
        } catch (err) {
          reject(new Error('数据解析失败，接口返回的不是合法 JSON'))
        }
      })
      stream.on('error', reject)
    })

    req.on('timeout', () => req.destroy(new Error('请求 mhydps.cn 超时')))
    req.on('error', reject)
  })
}

async function requestWithRetry (url, headers = {}, retry = 2) {
  let lastError
  for (let i = 0; i <= retry; i++) {
    try {
      return await getJson(url, headers)
    } catch (err) {
      lastError = err
      if (i < retry) await new Promise(resolve => setTimeout(resolve, 600 * (i + 1)))
    }
  }
  throw lastError
}

/** 站点接口（一次拉全量）；必须带 Referer，否则 nginx 会返回 403 */
async function fetchSite (path) {
  const data = await requestWithRetry(`${SITE_API}/${path}`, {
    Referer: `${SITE_URL}/`,
    Origin: SITE_URL,
    'Accept-Language': 'zh-CN,zh;q=0.9'
  })
  if (!Array.isArray(data)) throw new Error('站点接口数据格式异常')
  return data
}

/** 兼容旧缓存：站点接口若只返回部分字段，这里补默认值 */
function fillDefaults (rows) {
  return rows.map(row => ({
    ...row,
    members: Array.isArray(row?.members) ? row.members : [],
    tags: Array.isArray(row?.tags) ? row.tags : [],
    confirm: row?.confirm !== false
  }))
}

/** Supabase 兜底：分页拉取整张表（单次最多 1000 行） */
async function fetchSupabase (table, fields, order, { pageSize = 1000, maxRows = 5000 } = {}) {
  const rows = []
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${fields}` +
      `&order=${order}&limit=${pageSize}&offset=${offset}`
    const batch = await requestWithRetry(url, {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    })
    if (!Array.isArray(batch)) throw new Error('备用接口数据格式异常')
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

function warnFallback (err) {
  globalThis.logger?.warn?.(`[mhydps-plugin] 站点接口不可用，改用备用接口：${err?.message || err}`)
}

/** 拉取全部 DPS 配队数据 */
export async function fetchTeams () {
  try {
    return fillDefaults(await fetchSite('teams'))
  } catch (err) {
    warnFallback(err)
    return fillDefaults(await fetchSupabase('teams', TEAM_FIELDS, 'damage.desc'))
  }
}

/** 拉取危战竞速数据 */
export async function fetchStygian () {
  try {
    return fillDefaults(await fetchSite('teams2'))
  } catch (err) {
    warnFallback(err)
    return fillDefaults(await fetchSupabase('teams2', STYGIAN_FIELDS, 'speed.asc'))
  }
}
