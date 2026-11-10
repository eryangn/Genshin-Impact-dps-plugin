/** 把查询结果整理成「视图对象」，供文字 / 图片两种渲染器共用 */
import { config } from '../config/config.js'
import { charMeta, charTitle, elementCn } from './characters.js'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

export function mark (index) {
  return CIRCLED[index] || `${index + 1}.`
}

/** 1234567 -> 1,234,567 */
export function num (value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 金数 → { label: '8金' / '满配', sub: '限6' } */
export function gold (cost, limitCost) {
  const total = Number(cost) || 0
  const limit = Number(limitCost)
  return {
    label: total === 48 ? '满配' : `${total}金`,
    sub: Number.isFinite(limit) && limit > 0 && limit < total ? `限${limit}` : ''
  }
}

export function goldText (cost, limitCost) {
  const info = gold(cost, limitCost)
  return info.sub ? `${info.label}(${info.sub})` : info.label
}

/** 绿玩：站点 clean 标记，或标签里带「绿玩」 */
export function isClean (team) {
  return !!team?.clean || (Array.isArray(team?.tags) && team.tags.includes('绿玩'))
}

export function teamTags (team) {
  const tags = []
  if (isClean(team)) tags.push('绿玩')
  if (team?.lvl) tags.push('命星')
  if (Array.isArray(team?.tags) && team.tags.includes('宏')) tags.push('宏')
  return tags
}

export function teamNames (team) {
  return (team?.members || [])
    .map(m => (m.cons > 0 ? `${m.name}C${m.cons}` : m.name))
    .join(' ')
}

function median (values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function timeText (timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function footer (data) {
  return {
    source: 'mhydps.cn',
    count: `${num(data.total ?? data.list?.length ?? 0)} 队`,
    time: timeText(data.fetchedAt)
  }
}

function videoLink (team, index) {
  if (index >= (Number(config.videoCount) || 0)) return ''
  const url = String(team?.video || '')
  if (!url) return ''
  const bv = url.match(/BV[0-9A-Za-z]+/)
  if (bv) return bv[0]
  if (url.length <= 42) return url
  return ''
}

function rowFromTeam (team, index, showCost = true, cleanOnly = false) {
  return {
    rank: index + 1,
    value: num(team.dps),
    cost: showCost ? gold(team.cost, team.limitCost) : null,
    team: teamNames(team),
    members: team.members,
    tags: cleanOnly ? [] : teamTags(team),
    link: videoLink(team, index)
  }
}

function emptyView (title, message, data, hints = []) {
  return {
    title,
    subtitle: '',
    stats: [],
    sections: [{ type: 'note', lines: [message, ...hints] }],
    notes: [],
    footer: footer(data)
  }
}

function filterTeams (teams, cleanOnly) {
  return cleanOnly ? teams.filter(isClean) : teams
}

/** 角色总览 / 角色 + 金数 */
export function characterView (data, name, options = {}) {
  const cost = options.cost ?? null
  const cleanOnly = options.cleanOnly ?? false

  let rows = filterTeams(data.byChar.get(name) || [], cleanOnly)
  if (cost !== null) rows = rows.filter(row => row.cost === cost)

  const suffix = cost === null ? '' : ` · ${gold(cost).label}`

  if (!rows.length) {
    const perCost = new Map()
    for (const row of filterTeams(data.byChar.get(name) || [], cleanOnly)) {
      if (!perCost.has(row.cost)) perCost.set(row.cost, row)
    }
    const near = [...perCost.keys()]
      .filter(c => Math.abs(c - cost) <= 3)
      .sort((a, b) => a - b)
      .map(c => `${c}金`)
      .join('、')

    return {
      title: `${charTitle(name)}${suffix}`,
      stats: [],
      sections: [{
        type: 'note',
        lines: [
          cost === null ? '暂无该角色的配队数据。' : `${name} 在该金数下暂无收录。`,
          near ? `相邻档位：${near}` : ''
        ].filter(Boolean)
      }],
      notes: [],
      footer: footer(data)
    }
  }

  const best = rows[0]
  const stats = cost === null
    ? [
        { label: '最高DPS', value: `${num(best.dps)}` },
        { label: '金均', value: num(best.dps / Math.max(1, best.cost)) }
      ]
    : [
        { label: '最高', value: num(best.dps) },
        { label: '中位', value: num(median(rows.map(r => r.dps))) }
      ]

  const sections = []

  if (cost === null) {
    const perCost = new Map()
    for (const row of rows) {
      if (!perCost.has(row.cost)) perCost.set(row.cost, row)
    }
    let costs = [...perCost.keys()].sort((a, b) => a - b).filter(c => c <= 12 || c === 48)
    if (!costs.length) costs = [...perCost.keys()].sort((a, b) => a - b).slice(0, 8)

    sections.push({
      type: 'tiers',
      title: '各金数最佳配队',
      items: costs.map(c => {
        const row = perCost.get(c)
        return {
          cost: gold(row.cost, row.limitCost),
          value: num(row.dps),
          members: row.members,
          team: teamNames(row)
        }
      })
    })
  }

  const limit = cost === null ? Math.max(1, Number(config.topTeams) || 30) : Math.max(3, Number(config.topTeams) || 30)
  sections.push({
    type: 'rows',
    title: cost === null ? '顶尖队伍' : '全部队伍',
    items: rows.slice(0, limit).map((team, index) => rowFromTeam(team, index, cost === null, cleanOnly))
  })

  return {
    title: `${charTitle(name)}${suffix}`,
    subtitle: `收录 ${rows.length} 队`,
    avatarName: name,
    stats,
    sections,
    notes: ['金数 = 限定金 + 常驻金，满配为 48 金'],
    footer: footer(data)
  }
}

/** 角色各金数排名（#dps 角色 多少金 / #dps角色 8金） */
export function characterCostRankView (data, name, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const onlyCost = options.cost ?? null
  const teams = filterTeams(data.byChar.get(name) || [], cleanOnly)

  if (!teams.length) {
    return emptyView(`${charTitle(name)} · 金数排行`, '暂无该角色的配队数据。', data)
  }

  const perCost = new Map()
  for (const team of teams) {
    const current = perCost.get(team.cost)
    if (!current || team.dps > current.dps) perCost.set(team.cost, team)
  }

  let costs = [...perCost.keys()].sort((a, b) => a - b)
  if (onlyCost !== null) costs = costs.filter(c => c === onlyCost)
  else costs = costs.filter(c => c <= 12 || c === 48)

  if (!costs.length) {
    return emptyView(
      `${charTitle(name)} · ${onlyCost !== null ? gold(onlyCost).label : '金数排行'}`,
      `${name} 在该金数下暂无收录。`,
      data,
      [`用 #dps ${name} 多少金 查看全部档位`]
    )
  }

  const items = costs.map(cost => {
    const team = perCost.get(cost)
    const pool = filterTeams(data.byCost.get(cost) || [], cleanOnly)
    const rank = pool.indexOf(team) + 1
    return { cost, team, rank, total: pool.length }
  })

  const best = items.reduce((a, b) => (b.team.dps > a.team.dps ? b : a), items[0])

  return {
    title: onlyCost === null
      ? `${charTitle(name)} · 金数排行`
      : `${charTitle(name)} · ${gold(onlyCost).label} 排名`,
    subtitle: onlyCost === null
      ? `共 ${items.length} 个档位 ｜ 排名为该角色在该金数下的全站名次`
      : `${name} 在 ${gold(onlyCost).label} 下的最佳队伍与全站名次`,
    avatarName: name,
    stats: [
      { label: '最高DPS档位', value: gold(best.cost).label },
      { label: '该档排名', value: best.rank ? `#${best.rank}/${best.total}` : '—' },
      { label: '该档DPS', value: num(best.team.dps) }
    ],
    sections: [{
      type: 'table',
      head: ['金数', '最佳DPS', '全站排名', '队伍'],
      items: items.map(item => ({
        cells: [
          gold(item.cost).label,
          num(item.team.dps),
          item.rank ? `#${item.rank}/${item.total}` : '—',
          teamNames(item.team)
        ]
      }))
    }],
    notes: [
      '排名 = 该角色在该金数下的最佳队伍，在全站同金数队伍中的名次',
      '金数 = 限定金 + 常驻金，满配 48 金'
    ],
    footer: footer(data)
  }
}

/** 全站各金数统计 */
export function costTableView (data, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const rows = cleanOnly ? data.costs
    .map(cost => ({ cost, list: filterTeams(data.byCost.get(cost) || [], true) }))
    .filter(item => item.list.length)
    : data.costs.map(cost => ({ cost, list: data.byCost.get(cost) || [] }))

  const filtered = rows.filter(item => item.cost <= 12 || item.cost === 48)
  const total = rows.reduce((sum, item) => sum + item.list.length, 0)

  return {
    title: '全站各金数 DPS',
    subtitle: `共 ${num(total)} 支队伍 ｜ 展示 ${filtered.length} 个档位${cleanOnly ? ' ｜ 仅绿玩' : ''}`,
    stats: [],
    sections: [{
      type: 'table',
      head: ['金数', '最高DPS', '中位DPS', '队伍'],
      items: filtered.map(item => {
        const best = item.list[0]
        return {
          cells: [
            gold(item.cost).label,
            num(best.dps),
            num(median(item.list.map(r => r.dps))),
            `${item.list.length} 队`
          ]
        }
      })
    }],
    notes: [
      `共 ${data.costs.length} 个金数档位，更多档位用 #dps金数 <数字> 查询`,
      '想看每档的具体配队用 #dps各金数',
      '金数 = 限定金 + 常驻金，满配按 48 金计'
    ],
    footer: footer(data)
  }
}

/** 各金数最佳配队（金数 + DPS + 四名角色） */
export function goldTeamView (data, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const items = []

  for (const cost of data.costs) {
    if (!(cost <= 12 || cost === 48)) continue
    const list = filterTeams(data.byCost.get(cost) || [], cleanOnly)
    if (!list.length) continue
    const best = list[0]
    items.push({
      cost: gold(best.cost, best.limitCost),
      value: num(best.dps),
      members: best.members,
      team: teamNames(best),
      count: `${list.length} 队`,
      median: num(median(list.map(r => r.dps)))
    })
  }

  if (!items.length) {
    return emptyView('各金数最佳配队', '暂无收录数据。', data)
  }

  return {
    title: '各金数最佳配队',
    subtitle: `0 ~ 12 金 + 满配 ｜ ${items.length} 个档位${cleanOnly ? ' ｜ 仅绿玩' : ''}`,
    stats: [],
    sections: [{ type: 'tiers', title: '', items }],
    notes: ['每个档位取该金数下 DPS 最高的队伍', '看某档前 30 名用 #dps金数 8'],
    footer: footer(data)
  }
}

/** 指定金数排行 */
export function costRankView (data, cost, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const rows = filterTeams(data.byCost.get(cost) || [], cleanOnly)

  if (!rows.length) {
    const near = data.costs
      .filter(c => c >= cost - 3 && c <= cost + 3)
      .map(c => `${c}金`)
      .join('、')
    return emptyView(
      `${goldText(cost)} DPS 排行`,
      '该金数下暂无收录数据。',
      data,
      near ? [`相邻档位：${near}`] : [`可选档位：${data.costs.slice(0, 10).map(c => `${c}金`).join('、')}`]
    )
  }

  const limit = Math.max(1, Number(config.listLimit) || 30)
  return {
    title: `${gold(cost).label} DPS 排行`,
    subtitle: `共 ${rows.length} 队`,
    stats: [{ label: '最高', value: num(rows[0].dps) }, { label: '中位', value: num(median(rows.map(r => r.dps))) }],
    sections: [{
      type: 'rows',
      title: '',
      items: rows.slice(0, limit).map((team, index) => rowFromTeam(team, index, false, cleanOnly))
    }],
    notes: cleanOnly ? ['已过滤：仅显示绿玩（无宏）记录'] : [],
    footer: footer(data)
  }
}

/** 全站排行榜（可按金数筛选） */
export function teamRankView (data, cost = null, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const pool = cost === null ? data.teams : (data.byCost.get(cost) || [])
  const rows = filterTeams(pool, cleanOnly)
  const title = cost === null ? '全站 DPS 排行' : `${goldText(cost)} DPS 排行`

  if (!rows.length) {
    return emptyView(title, '该金数下暂无收录数据。', data, ['用 #dps金数表 查看有数据的档位'])
  }

  const limit = Math.max(1, Number(config.listLimit) || 30)
  return {
    title,
    subtitle: `共 ${num(rows.length)} 队${cleanOnly ? ' · 仅绿玩' : ''}`,
    stats: [],
    sections: [{
      type: 'rows',
      title: '',
      items: rows.slice(0, limit).map((team, index) => rowFromTeam(team, index, true, cleanOnly))
    }],
    notes: ['前 3 名附带参考视频，可用 BV 号在 B 站搜索'],
    footer: footer(data)
  }
}

/** 主C角色榜 */
export function characterRankView (data, cost = null, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const pool = filterTeams(cost === null ? data.teams : (data.byCost.get(cost) || []), cleanOnly)

  const best = new Map()
  for (const team of pool) {
    const main = team.members[0]?.name
    if (main && !best.has(main)) best.set(main, team)
  }

  const entries = [...best.entries()].sort((a, b) => b[1].dps - a[1].dps)
  const title = cleanOnly
    ? (cost === null ? '绿玩角色 DPS 榜' : `${goldText(cost)} 绿玩角色榜`)
    : (cost === null ? '主C角色 DPS 榜' : `${goldText(cost)} 主C角色榜`)

  if (!entries.length) return emptyView(title, '该金数下暂无主C数据。', data)

  const limit = cost === null ? 15 : 12
  return {
    title,
    subtitle: `按队伍首位（主C）统计 ｜ ${entries.length} 位角色${cleanOnly ? ' ｜ 仅绿玩' : ''}`,
    stats: [],
    sections: [{
      type: 'rows',
      title: '',
      items: entries.slice(0, limit).map(([name, team], index) => {
        const meta = charMeta(name)
        return {
          rank: index + 1,
          name,
          el: meta ? elementCn(meta.element) : '',
          value: num(team.dps),
          cost: gold(team.cost, team.limitCost),
          team: teamNames(team),
          tags: cleanOnly ? [] : teamTags(team),
          link: videoLink(team, index)
        }
      })
    }],
    notes: ['仅统计作为队伍首位（主C）的角色'],
    footer: footer(data)
  }
}

/** 两名角色各金数对比 */
export function compareView (data, nameA, nameB, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const rowsA = filterTeams(data.byChar.get(nameA) || [], cleanOnly)
  const rowsB = filterTeams(data.byChar.get(nameB) || [], cleanOnly)

  if (!rowsA.length && !rowsB.length) {
    return emptyView('角色 DPS 对比', `${nameA}、${nameB} 都没有收录数据。`, data)
  }

  const perCostA = new Map()
  for (const row of rowsA) if (!perCostA.has(row.cost)) perCostA.set(row.cost, row)
  const perCostB = new Map()
  for (const row of rowsB) if (!perCostB.has(row.cost)) perCostB.set(row.cost, row)

  const costs = [...new Set([...perCostA.keys(), ...perCostB.keys()])]
    .filter(c => c <= 12 || c === 48)
    .sort((a, b) => a - b)

  const bestA = rowsA[0]
  const bestB = rowsB[0]

  return {
    title: '角色 DPS 对比',
    subtitle: `${nameA} vs ${nameB}`,
    stats: [
      { label: nameA, value: bestA ? num(bestA.dps) : '—', sub: bestA ? goldText(bestA.cost, bestA.limitCost) : '' },
      { label: nameB, value: bestB ? num(bestB.dps) : '—', sub: bestB ? goldText(bestB.cost, bestB.limitCost) : '' }
    ],
    sections: [{
      type: 'pairs',
      title: '各金数最佳 DPS',
      head: [nameA, nameB],
      items: costs.map(c => ({
        label: gold(c).label,
        values: [
          perCostA.has(c) ? num(perCostA.get(c).dps) : '—',
          perCostB.has(c) ? num(perCostB.get(c).dps) : '—'
        ]
      }))
    }],
    notes: [
      !rowsA.length ? `${nameA} 暂未收录配队数据` : '',
      !rowsB.length ? `${nameB} 暂未收录配队数据` : ''
    ].filter(Boolean),
    footer: footer(data)
  }
}

/** 指定角色组合的配队 */
export function teamQueryView (data, names, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const pool = filterTeams(data.teams, cleanOnly)
  const maxCost = Number.isFinite(Number(options.maxCost)) ? Number(options.maxCost) : null
  const pageSize = Math.max(1, Number(options.pageSize) || 20)
  const page = Math.max(1, Number(options.page) || 1)
  const matched = pool
    .filter(team => names.every(name => team.members.some(m => m.name === name)))
    .filter(team => maxCost === null || team.cost <= maxCost)
    .sort((a, b) => b.dps - a.dps)
  const pages = Math.max(1, Math.ceil(matched.length / pageSize))
  const current = Math.min(page, pages)
  const slice = matched.slice((current - 1) * pageSize, current * pageSize)
  const title = `配队查询：${names.join(' + ')}${maxCost === null ? '' : ` · ≤${maxCost}金`}`

  if (!matched.length) {
    return emptyView(title, '没有收录同时包含这些角色的配队。', data, ['可以减少角色数量或放宽金数'])
  }

  return {
    title,
    subtitle: `共 ${matched.length} 队 ｜ 第 ${current}/${pages} 页`,
    stats: [],
    sections: [{
      type: 'rows',
      title: '',
      items: slice.map((team, index) => rowFromTeam(team, (current - 1) * pageSize + index, true, cleanOnly))
    }],
    notes: pages > 1 ? [`翻页：#dps配队 ${names.join(' ')} ${maxCost === null ? '' : `${maxCost}金 `}${current + 1}`.trim()] : [],
    footer: footer(data)
  }
}

/** 危战竞速榜 */
export function stygianView (data, cost = null, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const pool = filterTeams(data.list, cleanOnly)
  const maxCost = Number.isFinite(Number(options.maxCost)) ? Number(options.maxCost) : null
  const version = options.version ? String(options.version) : ''
  const boss = options.boss != null ? String(options.boss) : ''
  const rows = pool.filter(item => {
    if (cost !== null && item.cost !== cost) return false
    if (maxCost !== null && item.cost > maxCost) return false
    if (version && String(item.ver) !== version) return false
    if (boss && String(item.boss ?? '') !== boss) return false
    return true
  })
  const extra = [
    version ? `v${version}` : '',
    boss ? `BOSS ${boss}` : '',
    maxCost !== null ? `≤${maxCost}金` : ''
  ].filter(Boolean).join(' · ')
  const title = `危战竞速榜${cost === null ? '' : ` · ${goldText(cost)}`}${extra ? ` · ${extra}` : ''}`

  if (!rows.length) {
    return emptyView(title, '暂无符合条件的竞速记录。', data, ['可以去掉 BOSS 或金数限制再试'])
  }

  const limit = Math.max(1, Number(config.listLimit) || 30)
  return {
    title,
    subtitle: `共 ${rows.length} 条 ｜ 用时越短越强${cleanOnly ? ' ｜ 仅绿玩' : ''}`,
    theme: 'light',
    layout: 'stygian',
    stats: [],
    sections: [{
      type: 'rows',
      title: '',
      items: rows.slice(0, limit).map((item, index) => ({
        rank: index + 1,
        value: `${item.speed}s`,
        cost: gold(item.cost, item.limitCost),
        costText: `${item.cost}金`,
        team: `${item.ver ? `v${item.ver} ` : ''}${teamNames(item)}`,
        members: item.members,
        ver: item.ver,
        video: item.video || '',
        tags: cleanOnly ? [] : teamTags(item),
        link: videoLink(item, index)
      }))
    }],
    notes: ['危战数据同样来自 mhydps.cn，部分记录为玩家自行填报'],
    footer: footer(data)
  }
}

/** 危战金数排行：按金数分档，每档取用时最短的记录 */
export function stygianCostView (data, cost = null, options = {}) {
  const cleanOnly = options.cleanOnly ?? false
  const pool = filterTeams(data.list, cleanOnly)
  const limit = Math.max(1, Number(config.listLimit) || 30)

  if (cost !== null) {
    const rows = pool.filter(item => item.cost === cost)
    if (!rows.length) {
      return emptyView(
        `危战金数排行 · ${goldText(cost)}`,
        '该金数下暂无危战记录。',
        data,
        ['可用 #dps危战金数 查看各档位']
      )
    }

    return {
      title: `危战金数排行 · ${goldText(cost)}`,
      subtitle: `共 ${rows.length} 条 ｜ 用时越短越强${cleanOnly ? ' ｜ 仅绿玩' : ''}`,
      stats: [
        { label: '最快', value: `${rows[0].speed}s` },
        { label: '中位', value: `${median(rows.map(r => r.speed))}s` }
      ],
      sections: [{
        type: 'rows',
        title: '',
        items: rows.slice(0, limit).map((item, index) => ({
          rank: index + 1,
          value: `${item.speed}s`,
          cost: gold(item.cost, item.limitCost),
          team: `${item.ver ? `v${item.ver} ` : ''}${teamNames(item)}`,
          members: item.members,
          ver: item.ver,
          tags: cleanOnly ? [] : teamTags(item),
          link: videoLink(item, index)
        }))
      }],
      notes: ['危战排行按通关用时升序，时间越短排名越高'],
      footer: footer(data)
    }
  }

  const groups = new Map()
  for (const item of pool) {
    if (!groups.has(item.cost)) groups.set(item.cost, [])
    groups.get(item.cost).push(item)
  }

  const costs = [...groups.keys()].sort((a, b) => a - b)
  const shown = costs.filter(c => c <= 12 || c === 48)
  if (!shown.length) return emptyView('危战金数排行', '暂无危战记录。', data)

  const items = shown.map(c => {
    const list = groups.get(c)
    const best = list[0]
    return {
      cost: gold(best.cost, best.limitCost),
      value: `${best.speed}s`,
      members: best.members,
      team: `${best.ver ? `v${best.ver} ` : ''}${teamNames(best)}`,
      count: `${list.length} 条`,
      median: `${median(list.map(item => item.speed))}s`
    }
  })

  const extra = costs.filter(c => !shown.includes(c))
  return {
    title: '危战金数排行',
    subtitle: `按金数分档 ｜ 共 ${pool.length} 条 ｜ 展示 ${items.length} 个档位${cleanOnly ? ' ｜ 仅绿玩' : ''}`,
    stats: [],
    sections: [{ type: 'tiers', title: '', items }],
    notes: [
      '每个金数档位取用时最短的记录',
      '看某个档位的前 30 名：#dps危战金数 8',
      ...(extra.length ? [`其余档位：${extra.map(c => goldText(c)).join('、')}`] : [])
    ],
    footer: footer(data)
  }
}

/** 帮助 */
export function helpView () {
  const groups = [
    {
      title: '角色查询',
      color: '#ff8a5c',
      items: [
        { icon: 'user', cmd: '#dps玛薇卡', desc: '角色总览 + 各金数最佳配队' },
        { icon: 'coin', cmd: '#dps玛薇卡4', desc: '该角色在 4 金时的队伍' },
        { icon: 'trophy', cmd: '#dps玛薇卡多少金', desc: '该角色各金数的 DPS 与全站排名' },
        { icon: 'hash', cmd: '#dps玛薇卡8金', desc: '该角色在 8 金的排名与最佳队伍' },
        { icon: 'swap', cmd: '#dps金数玛薇卡4', desc: '同上，另一种写法' }
      ]
    },
    {
      title: '金数查询',
      color: '#e6c88a',
      items: [
        { icon: 'grid', cmd: '#dps各金数', desc: '每个金数的最佳配队（含角色）' },
        { icon: 'table', cmd: '#dps金数表', desc: '全站各金数最高 / 中位 DPS' },
        { icon: 'table', cmd: '#dps各金数最高', desc: '每个金数只取最高 DPS' },
        { icon: 'hash', cmd: '#dps金数 8', desc: '8 金队伍 DPS 排行' },
        { icon: 'trophy', cmd: '#dps排行', desc: '全站 DPS 排行，可加金数' },
        { icon: 'crown', cmd: '#dps角色榜', desc: '每个角色（主C）的最高 DPS' },
        { icon: 'leaf', cmd: '#dps绿玩榜', desc: '只看绿玩（无宏）的角色榜' }
      ]
    },
    {
      title: '进阶',
      color: '#8ab4ff',
      items: [
        { icon: 'scale', cmd: '#dps对比玛薇卡阿蕾奇诺', desc: '两名角色逐金数对比' },
        { icon: 'users', cmd: '#dps队伍玛薇卡班尼特', desc: '同时包含这些角色的队伍' },
        { icon: 'play', cmd: '#dps甘雨视频', desc: '该角色带视频的配队，可加 #序号' },
        { icon: 'play', cmd: '#dps甘雨8金视频', desc: '只看该角色 8 金带视频的配队' },
        { icon: 'download', cmd: '#dps甘雨8金视频下载', desc: '下载并发送指定视频（仅主人，和视频查询同一个功能）' },
        { icon: 'sword', cmd: '#dps武器 <UID>', desc: '查账号角色的武器/精炼/等级' },
        { icon: 'alert', cmd: '#dps危战', desc: '危战竞速榜，可加金数' },
        { icon: 'hash', cmd: '#dps危战金数', desc: '危战按金数分档排行' }
      ]
    },
    {
      title: '其他',
      color: '#b28cff',
      items: [
        { icon: 'refresh', cmd: '#dps更新', desc: '刷新数据缓存（仅主人）' },
        { icon: 'sliders', cmd: '#dps精度2', desc: '调整图片渲染精度（仅主人）' },
        { icon: 'download', cmd: '#dps插件更新', desc: '更新插件本体（仅主人，重启生效）' },
        { icon: 'link', cmd: '#dps链接', desc: '官网地址' }
      ]
    }
  ]

  return {
    title: '原神帮助',
    subtitle: 'MHYDPS · 原神 DPS 数据库查询 ｜ 数据来自 mhydps.cn',
    width: 1000,
    help: true,
    stats: [],
    sections: [{ type: 'help', groups }],
    notes: [
      '指令支持 #dps 与 #原神dps 两种前缀',
      '加「绿玩」只看无宏成绩：如 #dps排行 8 绿玩',
      '加「文字」强制输出文字：如 #dps 玛薇卡 文字',
      '视频列表可加序号看单条：如 #dps视频 甘雨 #2'
    ],
    footer: null
  }
}

/** 账号角色武器 / 练度（Enka 数据） */
export function weaponView (build, characters) {
  const list = characters || build.characters
  const items = list.map((char, index) => ({
    rank: index + 1,
    name: char.name,
    el: char.element ? elementCn(char.element) : '',
    level: char.level,
    cons: char.cons,
    weapon: char.weapon
  }))

  return {
    title: '角色武器',
    subtitle: `${build.nickname || '旅行者'} ｜ UID ${build.uid}` +
      `${build.level ? ` ｜ 冒险等阶 ${build.level}` : ''} ｜ ${items.length} 位角色`,
    stats: [],
    sections: [{ type: 'weapons', title: '', items }],
    notes: [
      '数据来自 Enka 公开角色展示，需在游戏内开启「显示角色详情」',
      '武器精炼与等级为账号当前状态'
    ],
    footer: { source: 'mhydps.cn · Enka', count: `${items.length} 位角色`, time: timeText(Date.now()) }
  }
}

/** 角色配队视频列表 */
export function videoView (rows, videoMeta, name, options = {}) {
  const items = rows.map((team, index) => ({
    rank: index + 1,
    dps: num(team.dps),
    cost: gold(team.cost, team.limitCost),
    team: teamNames(team),
    tags: teamTags(team),
    video: videoMeta.get(team.video) || {
      url: team.video,
      title: '',
      cover: '',
      duration: 0,
      author: '',
      bvid: ''
    }
  }))

  const costLabel = options.cost != null ? ` · ${gold(options.cost).label}` : ''
  const total = Number(options.total) || items.length
  const countText = options.index
    ? `第 ${options.index} 条 / 共 ${total} 条`
    : (total > items.length ? `展示 ${items.length} / 共 ${total} 条` : `${items.length} 条`)

  return {
    title: `${name} · 视频${options.index ? ` #${options.index}` : ''}`,
    subtitle: `带视频的配队 ${countText}${costLabel}${options.cleanOnly ? ' · 仅绿玩' : ''}`,
    stats: [],
    sections: [{ type: 'videos', title: '', items }],
    notes: options.index
      ? ['视频标题 / 封面来自 B 站公开接口']
      : ['加 #序号 查看单条：如 #dps视频 甘雨 #2', '视频标题 / 封面来自 B 站公开接口'],
    footer: { source: 'mhydps.cn', count: `${items.length} 条视频`, time: timeText(Date.now()) }
  }
}

/** 官网信息 */
export function linkView () {
  return {
    title: '原神 DPS 数据库',
    subtitle: 'mhydps.cn',
    stats: [],
    sections: [{
      type: 'note',
      lines: [
        '官网：https://www.mhydps.cn',
        '收录各金数配队 DPS、危战竞速、账号练度查询'
      ]
    }],
    notes: [],
    footer: null
  }
}

/** 危战 BOSS / 版本一览 */
export function stygianListView (data, version = '') {
  const rows = (data.list || []).filter(item => !version || String(item.ver) === String(version))
  if (!rows.length) {
    return emptyView('危战列表', '暂无危战数据。', data)
  }

  const groups = new Map()
  for (const item of rows) {
    const ver = String(item.ver || '未知')
    if (!groups.has(ver)) groups.set(ver, { bosses: new Set(), count: 0 })
    const group = groups.get(ver)
    group.bosses.add(String(item.boss ?? '未知'))
    group.count += 1
  }

  const versions = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
  return {
    title: version ? `危战列表 · v${version}` : '危战列表',
    subtitle: `${versions.length} 个版本 ｜ 共 ${rows.length} 条记录`,
    stats: [],
    sections: [{
      type: 'table',
      head: ['版本', 'BOSS 数', '记录数', '查询'],
      items: versions.map(([ver, group]) => ({
        cells: [
          `v${ver}`,
          String(group.bosses.size),
          String(group.count),
          `#${ver}危战第一间`
        ]
      }))
    }],
    notes: [
      '按版本 + 第几间查询：#7.1危战第二间',
      '只看低金：#dps危战 低金'
    ],
    footer: footer(data)
  }
}

/** 按名次取榜单视频 */
export function videoRankView (data, rank) {
  const index = Math.max(1, Number(rank) || 1) - 1
  const team = (data.teams || [])[index]
  if (!team) return null
  return {
    title: `第 ${index + 1} 名视频`,
    subtitle: `${team.members.map(m => m.name).join(' + ')} ｜ ${Math.round(team.dps)}`,
    stats: [],
    sections: [{
      type: 'note',
      lines: [
        `DPS：${Math.round(team.dps)}`,
        team.video ? `视频：${team.video}` : '这条没有收录视频链接'
      ]
    }],
    notes: [],
    footer: footer(data)
  }
}
