import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import fs from 'node:fs'
import { getData, getStygian } from './model/store.js'
import { resolveCharacter } from './model/characters.js'
import * as V from './model/view.js'
import { toText } from './model/text.js'
import { renderView, ensureRenderer, disableImage, imageDisabled, resetImage } from './model/render.js'
import { prefetchAvatars, clearAvatarCache } from './model/avatars.js'
import { getBuild } from './model/enka.js'
import { prefetchWeaponIcons } from './model/weapons.js'
import { prefetchVideos } from './model/videos.js'
import { downloadVideo, cleanupFile } from './model/download.js'
import { loadSettings, getSetting, setSetting } from './model/settings.js'
import { config } from './config/config.js'

/**
 * 兼容不同版本的 Yunzai：
 * 先按插件目录相对路径导入 plugin 基类，再尝试 Yunzai 根目录，最后退回全局 plugin（TRSS / Miao 都会挂到 global）
 */
async function resolvePluginBase () {
  const candidates = [
    new URL('../../lib/plugins/plugin.js', import.meta.url).href,
    pathToFileURL(join(process.cwd(), 'lib/plugins/plugin.js')).href
  ]

  for (const href of candidates) {
    try {
      const mod = await import(href)
      if (mod?.default) return mod.default
    } catch (err) { /* 换下一个候选 */ }
  }
  if (globalThis.plugin) return globalThis.plugin
  throw new Error('[mhydps-plugin] 未找到 Yunzai 插件基类，请确认插件放在 Yunzai 的 plugins/ 目录下')
}

const plugin = await resolvePluginBase()

const P = '^#?(?:原神)?dps'
const COST = '(\\d{1,2}金?|满配|满金)'
const FLAG = '(?:[\\s:：]*(?:绿玩|无宏|文字)){0,2}'

function imageSegment (buffer) {
  const segment = globalThis.segment
  if (segment?.image) return segment.image(buffer)
  return { type: 'image', file: buffer }
}

export class Mhydps extends plugin {
  constructor () {
    super({
      name: '原神DPS查询',
      dsc: '查询 mhydps.cn 原神DPS数据库：角色DPS、各金数DPS、配队排行',
      event: 'message',
      priority: 500,
      rule: [
        { reg: `${P}(?:帮助|help|菜单|指令|说明)?${FLAG}\\s*$`, fnc: 'help' },
        { reg: `${P}(?:更新|刷新数据?)\\s*$`, fnc: 'update', permission: 'master' },
        { reg: `${P}插件更新\\s*$`, fnc: 'pluginUpdate', permission: 'master' },
        { reg: `${P}(?:渲染)?精度[\\s:：]*(.*)$`, fnc: 'quality', permission: 'master' },
        { reg: `${P}[\\s:：]*(.+?)(?:的)?(?:多少金|几金|金数排行|金数排名)${FLAG}\\s*$`, fnc: 'characterCostRank' },
        { reg: `${P}[\\s:：]*(.+?)[\\s:：]*(\\d{1,2}|满配|满金)金${FLAG}\\s*$`, fnc: 'characterCostSingle' },
        { reg: `${P}(?:金数表|金表|金数统计)${FLAG}\\s*$`, fnc: 'costTable' },
        { reg: `${P}(?:各金数最高|金数最高|最高金数)${FLAG}\\s*$`, fnc: 'costTable' },
        { reg: `${P}(?:各金数|金数配队|配队表)${FLAG}\\s*$`, fnc: 'goldTeams' },
        { reg: `${P}金数?[\\s:：]*(.*)$`, fnc: 'costQuery' },
        { reg: `${P}(?:对比|比较)[\\s:：]*(.+)$`, fnc: 'compare' },
        { reg: `${P}(?:绿玩|无宏|纯净)(?:角色)?榜(?:[\\s:：]*${COST})?${FLAG}\\s*$`, fnc: 'cleanRank' },
        { reg: `${P}(?:角色榜|主C榜|角色排行)(?:[\\s:：]*${COST})?${FLAG}\\s*$`, fnc: 'characterRank' },
        { reg: `${P}(?:排行|榜单|排名)(?:[\\s:：]*${COST})?${FLAG}\\s*$`, fnc: 'rank' },
        { reg: `${P}(?:队伍|配队)[\\s:：]*(.+)$`, fnc: 'team' },
        { reg: `${P}危战列表(?:[\\s:：]*(\\d+(?:\\.\\d+)?))?${FLAG}\\s*$`, fnc: 'stygianList' },
        { reg: `${P}(\\d+(?:\\.\\d+)?)危战第?([一二三四五1-5])间${FLAG}\\s*$`, fnc: 'stygianRoom' },
        { reg: `${P}危战[\\s:：]*低金${FLAG}\\s*$`, fnc: 'stygianLow' },
        { reg: `${P}危战(?:各)?金数(?:表|排行|最高)?(?:[\\s:：]*${COST})?${FLAG}\\s*$`, fnc: 'stygianCost' },
        { reg: `${P}危战(?:[\\s:：]*${COST})?${FLAG}\\s*$`, fnc: 'stygian' },
        { reg: `${P}危战[\\s:：]*(\\d{1,4})${FLAG}\\s*$`, fnc: 'stygianBoss' },
        { reg: `${P}(?:武器|练度)[\\s:：]*(\\d{6,12})?(?:[\\s:：]+(.+))?${FLAG}\\s*$`, fnc: 'weapon' },
        { reg: `${P}.*视频.*下载.*${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}.*视频.*(?:#|第)\\d{1,2}号?${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}.*视频.*\\d{1,2}号${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}[\\s:：]*(.+?)(?:的)?视频[\\s:：]*(?:#|第)(\\d{1,2})号?${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}视频[\\s:：]*(.+?)[\\s:：]*(?:#|第)(\\d{1,2})号?${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}[\\s:：]*(.+?)(?:的)?视频[\\s:：]*(\\d{1,2})号${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}视频[\\s:：]*(.+?)[\\s:：]*(\\d{1,2})号${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}视频[\\s:：]*(?:第)?(\\d{1,3})(?:名|号)?${FLAG}\\s*$`, fnc: 'videoRank' },
        { reg: `${P}视频[\\s:：]*(.*)$`, fnc: 'video' },
        { reg: `${P}[\\s:：]*(.+?)(?:的)?视频(?:[\\s:：]*${COST})?${FLAG}\\s*$`, fnc: 'video' },
        { reg: `${P}(?:链接|官网|网址)${FLAG}\\s*$`, fnc: 'link' },
        { reg: `${P}[\\s:：]*(.+)$`, fnc: 'character' }
      ]
    })

    // 启动后预热本地缓存；之后每天自动更新一次
    getData().catch(() => {})
    getStygian().catch(() => {})
    const timer = setInterval(() => {
      getData(true).catch(() => {})
      getStygian(true).catch(() => {})
    }, 24 * 60 * 60 * 1000)
    timer.unref?.()
  }

  get text () {
    return String(this.e?.msg || '').trim()
  }

  /** 解析结尾的修饰词：绿玩 / 无宏 / 文字 */
  get info () {
    let text = this.text
    let clean = false
    let forceText = false

    for (let i = 0; i < 3; i++) {
      const matched = text.match(/[\s:：]*(绿玩|无宏|文字)\s*$/)
      if (!matched) break
      if (matched[1] === '文字') forceText = true
      else clean = true
      text = text.slice(0, matched.index).trim()
    }

    return { text, cleanOnly: clean || !!config.cleanOnly, forceText }
  }

  /** 解析金数：满配/满金/48 -> 48；数字 -> number */
  parseCost (raw) {
    const value = String(raw ?? '').trim().replace(/金$/g, '')
    if (!value) return null
    if (/^(满配|满金|满|max)$/i.test(value) || value === '48') return 48
    if (!/^\d{1,2}$/.test(value)) return null
    const num = Number(value)
    return num >= 0 && num <= 48 ? num : null
  }

  /** 统一异常处理 */
  async run (task) {
    try {
      return await task()
    } catch (err) {
      const message = err?.message || String(err)
      globalThis.logger?.error?.(`[mhydps-plugin] ${err?.stack || message}`)
      return this.reply([
        `查询失败：${message}`,
        '可能是网络波动，可以稍后重试，或发送 #dps更新 刷新缓存'
      ].join('\n'))
    }
  }

  /** 收集视图里需要头像的角色名 */
  avatarNames (view) {
    const names = []
    if (view.avatarName) names.push(view.avatarName)
    for (const section of view.sections || []) {
      if (!['rows', 'tiers', 'weapons'].includes(section.type)) continue
      for (const item of section.items) {
        if (item.members?.length) names.push(...item.members.map(m => m.name))
        else if (item.name) names.push(item.name)
      }
    }
    return names
  }

  /** 收集视图里需要的武器图标 */
  weaponIconNames (view) {
    const names = []
    for (const section of view.sections || []) {
      if (section.type !== 'weapons') continue
      for (const item of section.items) {
        if (item.weapon?.icon) names.push(item.weapon.icon)
      }
    }
    return names
  }

  /** 输出：优先图片，失败回退文字 */
  async send (view, forceText = false) {
    if (!forceText && config.image && !imageDisabled()) {
      try {
        await loadSettings()
        await ensureRenderer()
        let avatars = new Map()
        if (config.avatar) avatars = await prefetchAvatars(this.avatarNames(view))
        const icons = this.weaponIconNames(view)
        const weaponIcons = icons.length ? await prefetchWeaponIcons(icons) : new Map()
        const buffer = await renderView(view, avatars, weaponIcons)
        return this.reply(imageSegment(buffer))
      } catch (err) {
        disableImage(err.message)
        globalThis.logger?.warn?.(`[mhydps-plugin] 图片渲染失败，后续自动使用文字：${err.message}`)
      }
    }
    return this.reply(toText(view))
  }

  // ------------------------------ 指令 ------------------------------

  async help () {
    return this.send(V.helpView())
  }

  async link () {
    return this.send(V.linkView())
  }

  async update () {
    if (!this.e.isMaster) return this.reply('只有机器人主人才能刷新数据哦~')
    return this.run(async () => {
      const data = await getData(true)
      await getStygian(true).catch(() => null)
      resetImage()
      clearAvatarCache()
      const time = new Date().toLocaleString('zh-CN', { hour12: false })
      return this.reply(`数据已刷新\n共 ${V.num(data.total)} 支队伍 ｜ ${time}`)
    })
  }

  /** #dps插件更新：从仓库拉取最新插件代码（仅主人，重启后生效） */
  async pluginUpdate () {
    if (!this.e.isMaster) return this.reply('只有机器人主人才能更新插件哦~')
    return this.run(async () => {
      const { updatePlugin } = await import('./model/updater.js')
      const result = await updatePlugin()
      return this.reply(result.message)
    })
  }

  /** #dps精度 [数值|重置]：调整图片渲染倍率（仅主人） */
  async quality () {
    if (!this.e.isMaster) return this.reply('只有机器人主人才能调整渲染精度哦~')
    return this.run(async () => {
      const { text } = this.info
      const raw = (text.match(new RegExp(`${P}(?:渲染)?精度[\\s:：]*(.*)$`, 'i'))?.[1] || '').trim()
      await loadSettings()

      const current = getSetting('scale', config.renderScale)
      if (!raw) return this.reply(this.qualityText(current))

      if (/^(重置|默认|reset)$/i.test(raw)) {
        const saved = await setSetting('scale', null)
        return this.reply(
          `渲染精度已重置为默认 ${config.renderScale}x` +
          (saved ? '' : '\nRedis 不可用，仅本次运行生效')
        )
      }

      const scale = Number(raw.replace(/[xX倍]\s*$/, ''))
      if (!Number.isFinite(scale) || scale < 1 || scale > 3) {
        return this.reply('精度范围 1 ~ 3，例如：#dps精度 2 或 #dps精度 1.5')
      }

      const saved = await setSetting('scale', scale)
      return this.reply([
        `渲染精度已设为 ${scale}x`,
        `普通卡片约 ${Math.round((Number(config.imageWidth) || 720) * scale)}px 宽，帮助图约 ${Math.round(1000 * scale)}px`,
        saved ? '已写入 Redis，重启后仍然生效' : 'Redis 不可用，仅本次运行生效'
      ].join('\n'))
    })
  }

  qualityText (current) {
    const scale = Number(current) || Number(config.renderScale) || 2
    const base = Number(config.imageWidth) || 720
    return [
      '▎渲染精度',
      `当前 ${scale}x ｜ 普通卡片 ${Math.round(base * scale)}px 宽 ｜ 帮助图 ${Math.round(1000 * scale)}px`,
      '',
      '可选：1（省流）/ 1.5 / 2（默认）/ 3（高清）',
      '调整：#dps精度 2',
      '重置：#dps精度 重置'
    ].join('\n')
  }

  /** #dps金数表 */
  async costTable () {
    return this.run(async () => {
      const data = await getData()
      return this.send(V.costTableView(data, { cleanOnly: this.info.cleanOnly }), this.info.forceText)
    })
  }

  /** #dps各金数：每个金数档位的最佳配队 */
  async goldTeams () {
    return this.run(async () => {
      const data = await getData()
      return this.send(V.goldTeamView(data, { cleanOnly: this.info.cleanOnly }), this.info.forceText)
    })
  }

  /** #dps金数 8 / #dps金数 玛薇卡 4 */
  async costQuery () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const raw = (text.match(new RegExp(`${P}金数?[\\s:：]*(.*)$`, 'i'))?.[1] || '').trim()
      const parts = raw.split(/[\s,，]+/).filter(Boolean)

      if (!parts.length) {
        return this.reply('金数范围 0 ~ 48，用法：\n#dps金数 8 ─ 查看该金数排行\n#dps金数 玛薇卡 4 ─ 查看角色在该金数的队伍')
      }

      if (parts.length === 1) {
        const cost = this.parseCost(parts[0])
        if (cost === null) {
          return this.reply('金数范围 0 ~ 48，用法：\n#dps金数 8 ─ 查看该金数排行\n#dps金数 玛薇卡 4 ─ 查看角色在该金数的队伍')
        }
        const data = await getData()
        return this.send(V.costRankView(data, cost, { cleanOnly }), forceText)
      }

      if (parts.length === 2) {
        const cost = this.parseCost(parts[1])
        if (cost === null) return this.reply('金数格式不对，例如：#dps金数 玛薇卡 4')
        const data = await getData()
        const name = resolveCharacter(data, parts[0])
        if (!name) return this.reply(`没有识别到角色「${parts[0]}」，可用 #dps角色榜 查看收录角色`)
        return this.send(V.characterView(data, name, { cost, cleanOnly }), forceText)
      }

      return this.reply('用法：\n#dps金数 8\n#dps金数 玛薇卡 4')
    })
  }

  /** #dps 角色 多少金：查看该角色各金数的 DPS 与全站排名 */
  async characterCostRank () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const raw = (text.match(new RegExp(`${P}[\\s:：]*(.+?)(?:的)?(?:多少金|几金|金数排行|金数排名)\\s*$`, 'i'))?.[1] || '').trim()
      if (!raw) return this.reply('用法：#dps 玛薇卡 多少金')

      const data = await getData()
      const name = resolveCharacter(data, raw)
      if (!name) {
        return this.reply([
          `没有识别到角色「${raw}」`,
          '支持本名 / 别名（如 雷神、龟、爷）',
          '用 #dps角色榜 查看已收录的角色'
        ].join('\n'))
      }

      return this.send(V.characterCostRankView(data, name, { cleanOnly }), forceText)
    })
  }

  /** #dps 角色 8金：该角色在指定金数的排名 */
  async characterCostSingle () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const matched = text.match(new RegExp(`${P}[\\s:：]*(.+?)[\\s:：]*(\\d{1,2}|满配|满金)金\\s*$`, 'i'))
      if (!matched) return this.reply('用法：#dps 雷神 8金')

      const raw = matched[1].trim()
      const cost = this.parseCost(matched[2])
      if (cost === null) return this.reply('金数范围 0 ~ 48，例如：#dps 雷神 8金')

      const data = await getData()
      const name = resolveCharacter(data, raw)
      if (!name) return this.reply(`没有识别到角色「${raw}」`)

      return this.send(V.characterCostRankView(data, name, { cost, cleanOnly }), forceText)
    })
  }

  /** 解析「角色 + 金数」，金数可无空格、可不带「金」 */
  resolveNameCost (data, raw) {
    const input = String(raw ?? '').trim()
    let name = resolveCharacter(data, input)
    if (name) return { name, cost: null }

    const matched = input.match(/^(.*?)[\s:：]*(\d{1,2}|满配|满金)金?$/)
    if (matched && matched[1].trim()) {
      const cost = this.parseCost(matched[2])
      const found = resolveCharacter(data, matched[1].trim())
      if (found && cost !== null) return { name: found, cost }
    }

    return { name: null, cost: null }
  }

  /** #dps玛薇卡 / #dps 玛薇卡 4 */
  async character () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const raw = (text.match(new RegExp(`${P}[\\s:：]*(.+)$`, 'i'))?.[1] || '').trim()
      if (!raw) return this.send(V.helpView(), forceText)

      const parts = raw.split(/[\s,，]+/).filter(Boolean)
      const data = await getData()

      let cost = null
      let nameInput = raw
      if (parts.length === 2) {
        const parsed = this.parseCost(parts[1])
        if (parsed !== null) {
          cost = parsed
          nameInput = parts[0]
        }
      }

      // 允许「神里 绫华」这种被空格分开的角色名：先按原样匹配，再按去空格匹配
      const compact = raw.replace(/\s+/g, '')
      const resolved = this.resolveNameCost(data, nameInput)
      const compactResolved = resolved.name ? null : this.resolveNameCost(data, compact)
      const name = resolved.name || compactResolved?.name
      if (cost === null) cost = resolved.cost ?? compactResolved?.cost ?? null
      if (!name) {
        return this.reply([
          `没有识别到角色「${nameInput}」`,
          '支持本名 / 别名（如 雷神、龟、爷），也可以只输入其中两个字',
          '用 #dps角色榜 查看已收录的角色'
        ].join('\n'))
      }

      return this.send(V.characterView(data, name, { cost, cleanOnly }), forceText)
    })
  }

  /** #dps排行 [金数] */
  async rank () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const matched = text.match(new RegExp(`${P}(?:排行|榜单|排名)(?:[\\s:：]*${COST})?\\s*$`, 'i'))
      const cost = matched?.[1] ? this.parseCost(matched[1]) : null
      if (matched?.[1] && cost === null) return this.reply('金数格式不对，例如：#dps排行 8')
      const data = await getData()
      return this.send(V.teamRankView(data, cost, { cleanOnly }), forceText)
    })
  }

  /** #dps角色榜 [金数] */
  async characterRank () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const matched = text.match(new RegExp(`${P}(?:角色榜|主C榜|角色排行)(?:[\\s:：]*${COST})?\\s*$`, 'i'))
      const cost = matched?.[1] ? this.parseCost(matched[1]) : null
      if (matched?.[1] && cost === null) return this.reply('金数格式不对，例如：#dps角色榜 4')
      const data = await getData()
      return this.send(V.characterRankView(data, cost, { cleanOnly }), forceText)
    })
  }

  /** #dps绿玩榜 [金数]：只看绿玩（无宏）的角色榜 */
  async cleanRank () {
    return this.run(async () => {
      const { text, forceText } = this.info
      const matched = text.match(new RegExp(`${P}(?:绿玩|无宏|纯净)(?:角色)?榜(?:[\\s:：]*${COST})?\\s*$`, 'i'))
      const cost = matched?.[1] ? this.parseCost(matched[1]) : null
      if (matched?.[1] && cost === null) return this.reply('金数格式不对，例如：#dps绿玩榜 4')
      const data = await getData()
      return this.send(V.characterRankView(data, cost, { cleanOnly: true }), forceText)
    })
  }

  /** #dps对比 玛薇卡 阿蕾奇诺 */
  /** 把无空格的角色串拆成角色名，如「雷神龟」→ 雷神 / 龟 */
  splitNames (data, text) {
    const names = []
    let rest = String(text ?? '').trim()
    while (rest) {
      let matched = null
      for (let len = Math.min(6, rest.length); len >= 2; len--) {
        const part = rest.slice(0, len)
        const name = resolveCharacter(data, part)
        if (name) {
          matched = { name, len }
          break
        }
      }
      if (!matched) return null
      names.push(matched.name)
      rest = rest.slice(matched.len).replace(/^[\s,，、+＋]+/, '')
    }
    return names
  }

  async compare () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const raw = (text.match(new RegExp(`${P}(?:对比|比较)[\\s:：]*(.+)$`, 'i'))?.[1] || '').trim()
      const data = await getData()
      let inputs = raw.split(/\s*(?:vs|VS|Vs)\s*|[\s,，、+＋]+/).filter(Boolean)
      if (inputs.length === 1) {
        const split = this.splitNames(data, inputs[0])
        if (split && split.length === 2) inputs = split
      }
      if (inputs.length !== 2) {
        return this.reply('用法：#dps对比 玛薇卡 阿蕾奇诺\n一次对比两名角色的各金数DPS')
      }

      const nameA = resolveCharacter(data, inputs[0])
      const nameB = resolveCharacter(data, inputs[1])
      if (!nameA || !nameB) {
        return this.reply(`没有识别到角色：${[!nameA && inputs[0], !nameB && inputs[1]].filter(Boolean).join('、')}`)
      }
      return this.send(V.compareView(data, nameA, nameB, { cleanOnly }), forceText)
    })
  }

  /** #dps队伍 / #dps配队 玛薇卡 [N金] [页数] */
  async team () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      let raw = (text.match(new RegExp(`${P}(?:队伍|配队)[\\s:：]*(.+)$`, 'i'))?.[1] || '').trim()
      let maxCost = null
      let page = 1

      const costMatched = raw.match(/(\\d{1,2})\\s*金/)
      if (costMatched) {
        maxCost = Number(costMatched[1])
        raw = raw.replace(costMatched[0], ' ')
      }
      const pageMatched = raw.match(/(?:第)?(\\d{1,2})\\s*页/)
      if (pageMatched) {
        page = Math.max(1, Number(pageMatched[1]))
        raw = raw.replace(pageMatched[0], ' ')
      } else if (maxCost !== null) {
        const tail = raw.match(/(?:^|\\s)(\\d{1,2})\\s*$/)
        if (tail) {
          page = Math.max(1, Number(tail[1]))
          raw = raw.slice(0, tail.index).trim()
        }
      }

      const data = await getData()
      let inputs = raw.split(/[\\s,，、+＋]+/).filter(Boolean).slice(0, 4)
      if (inputs.length === 1) {
        const split = this.splitNames(data, inputs[0])
        if (split && split.length > 1) inputs = split.slice(0, 4)
      }
      if (!inputs.length) return this.reply('用法：#dps配队 玛薇卡 8金 2')

      const names = []
      const unknown = []
      for (const input of inputs) {
        const name = resolveCharacter(data, input)
        if (!name) unknown.push(input)
        else if (!names.includes(name)) names.push(name)
      }

      if (unknown.length) return this.reply(`没有识别到角色：${unknown.join('、')}`)
      return this.send(V.teamQueryView(data, names, { cleanOnly, maxCost, page }), forceText)
    })
  }

  /** #dps危战 [金数] */
  async stygian () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const matched = text.match(new RegExp(`${P}危战(?:[\\s:：]*${COST})?\\s*$`, 'i'))
      const cost = matched?.[1] ? this.parseCost(matched[1]) : null
      if (matched?.[1] && cost === null) return this.reply('金数格式不对，例如：#dps危战 4')
      const data = await getStygian()
      return this.send(V.stygianView(data, cost, { cleanOnly }), forceText)
    })
  }

  /** #dps危战金数 [金数] */
  async stygianCost () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info
      const matched = text.match(new RegExp(`${P}危战(?:各)?金数(?:表|排行|最高)?(?:[\\s:：]*${COST})?\\s*$`, 'i'))
      const cost = matched?.[1] ? this.parseCost(matched[1]) : null
      if (matched?.[1] && cost === null) return this.reply('金数格式不对，例如：#dps危战金数 8')
      const data = await getStygian()
      return this.send(V.stygianCostView(data, cost, { cleanOnly }), forceText)
    })
  }

  /** #dps危战列表 [版本] */
  async stygianList () {
    return this.run(async () => {
      const { text, forceText } = this.info
      const matched = text.match(new RegExp(`${P}危战列表(?:[\\s:：]*(\\d+(?:\\.\\d+)?))?\\s*$`, 'i'))
      const data = await getStygian()
      return this.send(V.stygianListView(data, matched?.[1] || ''), forceText)
    })
  }

  /** #dps危战 低金：只看金数 ≤2 */
  async stygianLow () {
    return this.run(async () => {
      const { forceText } = this.info
      const data = await getStygian()
      return this.send(V.stygianView(data, null, { maxCost: 2 }), forceText)
    })
  }

  /** #dps危战 602：按 BOSS ID 过滤 */
  async stygianBoss () {
    return this.run(async () => {
      const { text, forceText } = this.info
      const boss = text.match(new RegExp(`${P}危战[\\s:：]*(\\d{1,4})\\s*$`, 'i'))?.[1]
      const data = await getStygian()
      return this.send(V.stygianView(data, null, { boss }), forceText)
    })
  }

  /** #7.1危战第二间：版本 + 第几间 */
  async stygianRoom () {
    return this.run(async () => {
      const { text, forceText } = this.info
      const matched = text.match(new RegExp(`${P}(\\d+(?:\\.\\d+)?)危战第?([一二三四五1-5])间\\s*$`, 'i'))
      if (!matched) return this.reply('用法：#7.1危战第二间')
      const version = matched[1]
      const roomMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 }
      const room = roomMap[matched[2]] || Number(matched[2])
      const data = await getStygian()
      const bosses = [...new Set(
        (data.list || []).filter(item => String(item.ver) === String(version)).map(item => String(item.boss ?? ''))
      )].filter(Boolean).sort((a, b) => Number(a) - Number(b))
      const boss = bosses[room - 1]
      if (!boss) {
        return this.reply(`v${version} 只找到 ${bosses.length} 个 BOSS，没有第 ${room} 间`)
      }
      return this.send(V.stygianView(data, null, { version, boss }), forceText)
    })
  }

  /** #dps视频 3：取榜单第 3 名的视频 */
  async videoRank () {
    return this.run(async () => {
      const { text, forceText } = this.info
      const rank = Number(text.match(new RegExp(`${P}视频[\\s:：]*(?:第)?(\\d{1,3})(?:名|号)?\\s*$`, 'i'))?.[1] || 0)
      const data = await getData()
      const view = V.videoRankView(data, rank)
      if (!view) return this.reply('没有这个名次')
      return this.send(view, forceText)
    })
  }

  /** #dps武器 <UID> [角色]：查账号角色的武器 */
  async weapon () {
    return this.run(async () => {
      const { text, forceText } = this.info
      const matched = text.match(new RegExp(`${P}(?:武器|练度)[\\s:：]*(\\d{6,12})?(?:[\\s:：]+(.+))?$`, 'i'))
      if (!matched?.[1]) {
        return this.reply('用法：#dps武器 <UID> [角色]\n例：#dps武器 618285856 或 #dps武器 618285856 玛薇卡')
      }

      const uid = matched[1]
      const input = (matched[2] || '').trim()
      const build = await getBuild(uid)

      let list = build.characters
      if (input) {
        const target = resolveCharacter(null, input)
        list = build.characters.filter(char =>
          char.name === input || (target && char.name === target) || char.name.includes(input)
        )
        if (!list.length) {
          return this.reply(
            `该账号展示的角色里没有「${input}」\n展示角色：${build.characters.map(char => char.name).join('、')}`
          )
        }
      }

      return this.send(V.weaponView(build, list), forceText)
    })
  }

  /** #dps 甘雨视频 [金数] [#序号] / #dps视频 甘雨 [金数] [#序号] */
  /** 发送视频文件：优先复制进 NapCat 容器，容器读得到；否则退回 base64 */
  async sendVideoFile (file, caption) {
    const segment = globalThis.segment

    if (process.platform === 'linux') {
      try {
        const { execFileSync } = await import('node:child_process')
        const names = execFileSync('sudo', ['docker', 'ps', '--format', '{{.Names}}'], { encoding: 'utf8' })
          .split('\n').map(s => s.trim()).filter(n => /napcat/i.test(n))
        if (names.length) {
          const name = `mhydps-${Date.now()}.mp4`
          for (const container of names) {
            execFileSync('sudo', ['docker', 'exec', container, 'mkdir', '-p', '/app/napcat/tmp'], { stdio: 'ignore' })
            // 发之前先清掉 1 小时前的残留
            execFileSync('sudo', ['docker', 'exec', container, 'sh', '-c', 'find /app/napcat/tmp -name "mhydps-*.mp4" -mmin +60 -delete'], { stdio: 'ignore' })
            execFileSync('sudo', ['docker', 'cp', file, `${container}:/app/napcat/tmp/${name}`], { stdio: 'ignore' })
          }
          const inner = `file:///app/napcat/tmp/${name}`
          const videoSeg = segment?.video ? segment.video(inner) : { type: 'video', file: inner }
          const result = await this.reply([videoSeg, `\n${caption}`])

          // 3 分钟后自动删除容器内的临时视频
          const timer = setTimeout(() => {
            for (const container of names) {
              try {
                execFileSync('sudo', ['docker', 'exec', container, 'rm', '-f', `/app/napcat/tmp/${name}`], { stdio: 'ignore' })
              } catch (err) { /* 忽略清理失败 */ }
            }
          }, 180000)
          timer.unref?.()
          return result
        }
      } catch (err) {
        globalThis.logger?.warn?.(`[mhydps-plugin] 容器内发送失败，改用 base64：${err.message}`)
      }
    }

    const buffer = fs.readFileSync(file)
    const videoSeg = segment?.video ? segment.video(`base64://${buffer.toString('base64')}`) : { type: 'video', file: buffer }
    return this.reply([videoSeg, `\n${caption}`])
  }

  async video () {
    return this.run(async () => {
      const { text, cleanOnly, forceText } = this.info

      let working = text

      // 序号：#2 / 第2 / 2号
      let index = null
      const indexMatch = working.match(/[\s:：]*(?:#|第)(\d{1,2})号?\s*$/i) ||
        working.match(/[\s:：]*(\d{1,2})号\s*$/i)
      if (indexMatch) {
        index = Number(indexMatch[1])
        working = working.slice(0, indexMatch.index).trim()
      }

      // 下载意图：#dps 甘雨 8金视频 下载 / #dps视频下载 甘雨 8金
      let wantDownload = false
      if (/视频[\s:：]*下载/.test(working)) {
        wantDownload = true
        working = working.replace(/视频[\s:：]*下载/, '视频')
      }
      if (/[\s:：]*下载\s*$/.test(working)) {
        wantDownload = true
        working = working.replace(/[\s:：]*下载\s*$/, '').trim()
      }

      // 序号写在「下载」前面的情况：#dps 甘雨 8金视频 #2 下载
      if (index === null) {
        const late = working.match(/[\s:：]*(?:#|第)(\d{1,2})号?\s*$/i) ||
          working.match(/[\s:：]*(\d{1,2})号\s*$/i)
        if (late) {
          index = Number(late[1])
          working = working.slice(0, late.index).trim()
        }
      }

      let raw = ''
      let costRaw = ''

      const first = working.match(new RegExp(`${P}视频[\\s:：]*(.*)$`, 'i'))
      if (first) {
        raw = (first[1] || '').trim()
        const parts = raw.split(/[\s,，]+/).filter(Boolean)
        if (parts.length && this.parseCost(parts[parts.length - 1]) !== null) {
          costRaw = parts.pop()
          raw = parts.join(' ')
        }
      } else {
        const second = working.match(new RegExp(`${P}[\\s:：]*(.+?)(?:的)?视频(?:[\\s:：]*(${COST}))?$`, 'i'))
        if (!second) return this.reply('用法：#dps 甘雨视频 [金数] [#序号]')
        raw = second[1].trim()
        costRaw = second[2] || ''
      }

      if (!raw) {
        return this.reply('用法：#dps 甘雨视频 [金数] [#序号]\n例：#dps 甘雨视频 或 #dps视频 甘雨 4 #2')
      }

      // 支持「#dps雷神 8金视频」「#dps雷神8金视频」这种把金数写在角色后面的形式
      if (!costRaw) {
        const attached = raw.match(/^(.*?)[\s:：]*(\d{1,2}|满配|满金)金$/)
        if (attached && attached[1].trim()) {
          raw = attached[1].trim()
          costRaw = attached[2]
        }
      }

      // 支持「#dps视频木偶17#2」：角色名后直接跟金数，没有「金」字
      if (!costRaw) {
        const digits = raw.match(/^(.*?)(\d{1,2})$/)
        if (digits && digits[1].trim() && this.parseCost(digits[2]) !== null) {
          raw = digits[1].trim()
          costRaw = digits[2]
        }
      }

      const cost = costRaw ? this.parseCost(costRaw) : null
      if (costRaw && cost === null) return this.reply('金数格式不对，例如：#dps 甘雨视频 4')

      const data = await getData()
      const name = resolveCharacter(data, raw)
      if (!name) return this.reply(`没有识别到角色「${raw}」\n可用 #dps角色榜 查看收录角色`)

      let rows = (data.byChar.get(name) || []).filter(team => team.video)
      if (cleanOnly) rows = rows.filter(V.isClean)
      if (cost !== null) rows = rows.filter(team => team.cost === cost)

      if (!rows.length) {
        return this.reply(
          `没有收录「${name}」${cost !== null ? `在 ${V.goldText(cost)}` : ''}带视频的配队` +
          `${cleanOnly ? '（绿玩）' : ''}`
        )
      }

      const total = rows.length

      if (wantDownload) {
        const pick = index ?? 1
        if (!Number.isInteger(pick) || pick < 1 || pick > total) {
          return this.reply(`序号超出范围：共 ${total} 条，可用 #1 ~ #${total}`)
        }
        if (config.videoDownload === false) {
          return this.reply('视频发送功能已关闭，可在 config/config.js 打开 videoDownload')
        }
        if (config.videoDownloadMasterOnly !== false && !this.e.isMaster) {
          return this.reply('只有机器人主人才能让机器人发送视频文件哦~')
        }

        const team = rows[pick - 1]
        await this.reply(`正在下载第 ${pick} 条视频，约 10~30 秒…`)

        const result = await downloadVideo(team.video, {
          qn: config.videoQuality,
          maxMB: config.videoMaxMB
        })
        cleanupFile(result.file)

        const caption = [
          result.title || `${name} 视频`,
          result.bvid ? `https://www.bilibili.com/video/${result.bvid}` : ''
        ].filter(Boolean).join('\n')

        return this.sendVideoFile(result.file, caption)
      }

      if (index !== null) {
        if (!Number.isInteger(index) || index < 1 || index > total) {
          return this.reply(`序号超出范围：共 ${total} 条，可用 #1 ~ #${total}`)
        }
        rows = [rows[index - 1]]
      } else {
        const limit = Math.max(1, Number(config.videoLimit) || 8)
        rows = rows.slice(0, limit)
      }

      const videoMeta = await prefetchVideos(rows.map(team => team.video))
      return this.send(V.videoView(rows, videoMeta, name, { cost, cleanOnly, total, index }), forceText)
    })
  }

  /** #dps视频下载 甘雨 #2：下载并发送视频文件 */
  async videoDownload () {
    if (config.videoDownload === false) {
      return this.reply('视频发送功能已关闭，可在 config/config.js 打开 videoDownload')
    }
    if (config.videoDownloadMasterOnly !== false && !this.e.isMaster) {
      return this.reply('只有机器人主人才能让机器人发送视频文件哦~')
    }

    return this.run(async () => {
      const { text, cleanOnly } = this.info

      let working = text
      let index = 1
      const indexMatch = working.match(/[\s:：]*(?:#|第)(\d{1,2})号?\s*$/i) ||
        working.match(/[\s:：]*(\d{1,2})号\s*$/i)
      if (indexMatch) {
        index = Number(indexMatch[1])
        working = working.slice(0, indexMatch.index).trim()
      }

      let raw = ''
      const first = working.match(new RegExp(`${P}视频下载[\\s:：]*(.*)$`, 'i'))
      if (first) {
        raw = (first[1] || '').trim()
      } else {
        const second = working.match(new RegExp(`${P}[\\s:：]*(.+?)(?:的)?视频下载$`, 'i'))
        if (second) raw = second[1].trim()
      }
      if (!raw) return this.reply('用法：#dps视频下载 甘雨 #2\n第 1 条可省略序号：#dps视频下载 甘雨')

      const data = await getData()
      const name = resolveCharacter(data, raw)
      if (!name) return this.reply(`没有识别到角色「${raw}」`)

      let rows = (data.byChar.get(name) || []).filter(team => team.video)
      if (cleanOnly) rows = rows.filter(V.isClean)
      if (!rows.length) return this.reply(`没有收录「${name}」带视频的配队`)
      if (index < 1 || index > rows.length) {
        return this.reply(`序号超出范围：共 ${rows.length} 条，可用 #1 ~ #${rows.length}`)
      }

      const team = rows[index - 1]
      await this.reply(`正在下载第 ${index} 条视频，约 10~30 秒…`)

      const result = await downloadVideo(team.video, {
        qn: config.videoQuality,
        maxMB: config.videoMaxMB
      })
      cleanupFile(result.file)

      const caption = [
        result.title || `${name} 视频`,
        result.bvid ? `https://www.bilibili.com/video/${result.bvid}` : ''
      ].filter(Boolean).join('\n')

      return this.sendVideoFile(result.file, caption)
    })
  }
}

export default Mhydps
