/** 通过 UID 拉取角色展示数据（Enka 公开接口 / mhydps 同源代理），用于查询角色武器 */
import https from 'node:https'
import zlib from 'node:zlib'
import { characterNameById, charMeta } from './characters.js'
import { weaponInfo } from './weapons.js'

const SITE = 'https://www.mhydps.cn'
const SOURCES = [
  { name: 'mhydps', url: uid => `${SITE}/api/enka/uid/${uid}`, headers: { Referer: `${SITE}/`, 'User-Agent': 'MHYDPS-CN/1.0' } },
  { name: 'enka', url: uid => `https://enka.network/api/uid/${uid}`, headers: { 'User-Agent': 'Yunzai-mhydps-plugin/1.6' } }
]

const CACHE_TTL = 5 * 60 * 1000
const cache = new Map()
const pending = new Map()

function getJson (url, headers = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      agent: false,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        ...headers
      }
    }, res => {
      let stream = res
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase()
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate())

      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').trim()
        if (res.statusCode === 404) return reject(Object.assign(new Error('没有找到该 UID，或该玩家没有公开角色展示'), { code: 404 }))
        if (res.statusCode === 424) return reject(Object.assign(new Error('Enka 服务维护中，请稍后再试'), { code: 424 }))
        if (res.statusCode === 429) return reject(Object.assign(new Error('请求过于频繁，请稍后再试'), { code: 429 }))
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`练度接口返回 HTTP ${res.statusCode}`))
        }
        try {
          resolve(JSON.parse(body))
        } catch (err) {
          reject(new Error('练度接口返回的不是合法 JSON'))
        }
      })
      stream.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('请求练度数据超时')))
    req.on('error', reject)
  })
}

function normalize (uid, data) {
  const info = data.playerInfo || {}
  const characters = (data.avatarInfoList || []).map(avatar => {
    const id = Number(avatar.avatarId)
    const name = characterNameById(id) || `角色#${id}`
    const meta = charMeta(name)
    const level = Number(avatar.propMap?.['4001']?.val) || 0
    const cons = Array.isArray(avatar.talentIdList) ? avatar.talentIdList.length : 0

    const equip = (avatar.equipList || []).find(item => item?.flat?.itemType === 'ITEM_WEAPON')
    let weapon = null
    if (equip) {
      const raw = equip.weapon || {}
      const affix = raw.affixMap ? Object.values(raw.affixMap) : []
      const refine = affix.length ? Math.max(...affix) + 1 : 1
      const metaWeapon = weaponInfo(equip.itemId)
      weapon = {
        id: Number(equip.itemId) || 0,
        name: metaWeapon?.name || `武器#${equip.itemId}`,
        rank: metaWeapon?.rank || Number(equip.flat?.rankLevel) || 0,
        type: metaWeapon?.type || '',
        icon: metaWeapon?.icon || equip.flat?.icon || '',
        level: Number(raw.level) || 0,
        refine
      }
    }

    return { id, name, element: meta?.element || '', level, cons, weapon }
  })

  return {
    uid: String(uid),
    nickname: String(info.nickname || ''),
    level: Number(info.level) || 0,
    signature: String(info.signature || ''),
    characters
  }
}

async function fetchBuild (uid) {
  let lastError
  for (const source of SOURCES) {
    try {
      const data = await getJson(source.url(uid), source.headers)
      if (!Array.isArray(data.avatarInfoList) || !data.avatarInfoList.length) {
        lastError = new Error('该账号没有公开的角色展示数据（游戏内需开启「显示角色详情」）')
        continue
      }
      return normalize(uid, data)
    } catch (err) {
      lastError = err
      // 404/424/429 是账号或服务状态，不必换源重试
      if (err?.code === 404 || err?.code === 424 || err?.code === 429) break
    }
  }
  throw lastError || new Error('获取练度数据失败')
}

/** 取某 UID 的角色展示数据（5 分钟缓存） */
export async function getBuild (uid, force = false) {
  const key = String(uid)
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < CACHE_TTL) return hit.data
  if (pending.has(key)) return pending.get(key)

  const task = fetchBuild(key)
    .then(data => {
      cache.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => pending.delete(key))

  pending.set(key, task)
  return task
}
