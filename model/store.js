/** 数据缓存与聚合 */
import { fetchTeams, fetchStygian } from './api.js'
import { canonicalName } from './characters.js'
import { config } from '../config/config.js'

const caches = {
  teams: { at: 0, data: null, promise: null },
  stygian: { at: 0, data: null, promise: null }
}

function ttl () {
  return Math.max(1, Number(config.cacheMinutes) || 30) * 60 * 1000
}

function normalizeTeam (row) {
  const members = (Array.isArray(row?.members) ? row.members : [])
    .map(m => ({
      name: canonicalName(String(m?.charId ?? '').trim()),
      cons: Math.max(0, Number(m?.constellation) || 0)
    }))
    .filter(m => m.name)

  return {
    id: row?.id,
    dps: Number(row?.damage) || 0,
    cost: Number(row?.cost) || 0,
    limitCost: Number(row?.limitcost) || 0,
    normalCost: Number(row?.normalcost) || 0,
    members,
    tags: Array.isArray(row?.tags) ? row.tags.filter(Boolean).map(String) : [],
    video: String(row?.video_url || ''),
    clean: !!row?.clean,
    lvl: !!row?.lvl
  }
}

function normalizeStygian (row) {
  const members = (Array.isArray(row?.members) ? row.members : [])
    .map(m => ({
      name: canonicalName(String(m?.charId ?? '').trim()),
      cons: Math.max(0, Number(m?.constellation) || 0)
    }))
    .filter(m => m.name)

  return {
    id: row?.id,
    speed: Number(row?.speed) || 0,
    cost: Number(row?.cost) || 0,
    limitCost: Number(row?.limitcost) || 0,
    members,
    ver: String(row?.ver || ''),
    boss: row?.boss ?? null,
    clean: !!row?.clean,
    lvl: !!row?.lvl,
    tags: Array.isArray(row?.tags) ? row.tags.filter(Boolean).map(String) : [],
    video: String(row?.video_url || '')
  }
}

/** 把原始队伍列表聚合成查询用的索引 */
function buildIndex (teams) {
  const byCost = new Map()
  const byChar = new Map()
  const curve = new Map()
  const mainBest = new Map()

  for (const team of teams) {
    if (!byCost.has(team.cost)) byCost.set(team.cost, [])
    byCost.get(team.cost).push(team)

    for (const member of team.members) {
      if (!byChar.has(member.name)) byChar.set(member.name, [])
      byChar.get(member.name).push(team)

      if (!curve.has(member.name)) curve.set(member.name, new Map())
      const perCost = curve.get(member.name)
      if (!perCost.has(team.cost)) perCost.set(team.cost, team)
    }

    const main = team.members[0]?.name
    if (main && !mainBest.has(main)) mainBest.set(main, team)
  }

  const costs = [...byCost.keys()].sort((a, b) => a - b)

  return {
    teams,
    total: teams.length,
    byCost,
    byChar,
    curve,
    mainBest,
    costs,
    maxCost: costs.length ? costs[costs.length - 1] : 0
  }
}

async function loadTeams () {
  const rows = await fetchTeams()
  const normalized = rows
    .filter(row => !config.onlyConfirmed || row?.confirm !== false)
    .map(normalizeTeam)
    .filter(team => team.dps > 0 && team.members.length > 0)
    .sort((a, b) => b.dps - a.dps)

  // 同一份成绩被重复投稿时只保留排名最高的一条
  const seen = new Set()
  const teams = []
  for (const team of normalized) {
    const key = [
      team.cost,
      team.dps,
      team.members.map(m => `${m.name}C${m.cons}`).sort().join('|')
    ].join('#')
    if (seen.has(key)) continue
    seen.add(key)
    teams.push(team)
  }

  if (!teams.length) throw new Error('没有获取到有效的配队数据')

  return {
    ...buildIndex(teams),
    fetchedAt: Date.now()
  }
}

/**
 * 获取聚合后的 DPS 数据（带缓存，并发请求会复用同一次拉取）
 * @param {boolean} force 是否强制刷新
 */
export async function getData (force = false) {
  const cache = caches.teams
  const fresh = cache.data && Date.now() - cache.at < ttl()
  if (!force && fresh) return cache.data
  if (cache.promise) return cache.promise

  cache.promise = loadTeams()
    .then(data => {
      caches.teams = { at: Date.now(), data, promise: null }
      return data
    })
    .catch(err => {
      cache.promise = null
      // 拉取失败时，如果手上有旧数据就先兜底，避免整条指令不可用
      if (cache.data) {
        globalThis.logger?.warn?.(`[mhydps-plugin] 刷新失败，使用缓存数据：${err.message}`)
        return cache.data
      }
      throw err
    })

  return cache.promise
}

/** 危战（teams2）数据，按用时升序 */
export async function getStygian (force = false) {
  const cache = caches.stygian
  if (!force && cache.data && Date.now() - cache.at < ttl()) return cache.data
  if (cache.promise) return cache.promise

  cache.promise = fetchStygian()
    .then(rows => {
      const list = rows
        .filter(row => !config.onlyConfirmed || row?.confirm !== false)
        .map(normalizeStygian)
        .filter(item => item.speed > 0 && item.members.length > 0)
        .sort((a, b) => a.speed - b.speed)
      const data = { list, fetchedAt: Date.now() }
      caches.stygian = { at: Date.now(), data, promise: null }
      return data
    })
    .catch(err => {
      cache.promise = null
      if (cache.data) return cache.data
      throw err
    })

  return cache.promise
}

/** 清空缓存 */
export function clearCache () {
  caches.teams = { at: 0, data: null, promise: null }
  caches.stygian = { at: 0, data: null, promise: null }
}
