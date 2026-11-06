/** 角色名 / 别名解析 */
import { CHARACTERS } from './character-data.js'

export const ELEMENT_CN = {
  Pyro: '火',
  Hydro: '水',
  Anemo: '风',
  Electro: '雷',
  Dendro: '草',
  Cryo: '冰',
  Geo: '岩',
  Physical: '物理'
}

const META = new Map()
const ALIAS_TO_NAME = new Map()
const ID_TO_NAME = new Map()
for (const [name, alias, rarity, element, id] of CHARACTERS) {
  META.set(name, { name, alias: alias || [], rarity: rarity || 5, element: element || '', id: Number(id) || 0 })
  if (id) ID_TO_NAME.set(Number(id), name)
  for (const word of alias || []) {
    const key = String(word).toLowerCase()
    if (!ALIAS_TO_NAME.has(key)) ALIAS_TO_NAME.set(key, name)
  }
}
// 空 / 荧两个旅行者共用一个展示名
ID_TO_NAME.set(10000005, '旅行者')
ID_TO_NAME.set(10000007, '旅行者')

/** 角色 ID（站点头像 /charactor/<id>.webp 用） */
export function characterId (name) {
  return META.get(name)?.id || 0
}

/** 角色 ID → 角色名（Enka 的 avatarId 用） */
export function characterNameById (id) {
  return ID_TO_NAME.get(Number(id)) || ''
}

/** 把站点里可能出现的别名统一成标准角色名（如「爷」-> 旅行者） */
export function canonicalName (name) {
  const raw = String(name ?? '').trim()
  if (!raw) return raw
  return ALIAS_TO_NAME.get(raw.toLowerCase()) || raw
}

/** 取角色基础信息（不在内置表中的新角色返回 null） */
export function charMeta (name) {
  return META.get(name) || null
}

export function elementCn (element) {
  return ELEMENT_CN[element] || ''
}

/** 角色展示名，例如「玛薇卡 · 火 · ★5」 */
export function charTitle (name) {
  const meta = charMeta(name)
  if (!meta) return name
  const el = elementCn(meta.element)
  return el ? `${name} · ${el} · ★${meta.rarity}` : `${name} · ★${meta.rarity}`
}

/**
 * 把用户输入解析成站点数据里使用的角色名
 * 支持：本名、别名（英文名 / 昵称）、简称模糊匹配
 * @returns {string|null}
 */
export function resolveCharacter (data, input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  const known = data?.byChar ?? new Map()

  // 1. 与数据中的角色名完全一致
  if (known.has(raw)) return raw

  // 2. 与内置角色表的本名一致
  if (META.has(raw)) return raw

  // 3. 别名完全一致（优先取数据中确实有配队的角色）
  let fallback = null
  for (const [name, meta] of META) {
    if (meta.alias.some(a => String(a).toLowerCase() === lower)) {
      if (known.has(name)) return name
      fallback = fallback || name
    }
  }
  if (fallback) return fallback

  // 4. 数据中角色名的模糊匹配（新角色不在内置表里时也能查）
  const fuzzy = []
  for (const name of known.keys()) {
    const meta = META.get(name)
    const words = [name, ...(meta?.alias || [])].map(w => String(w).toLowerCase())
    if (words.some(w => w === lower)) return name
    if (words.some(w => w.includes(lower))) fuzzy.push([name, known.get(name).length])
  }
  if (fuzzy.length) {
    fuzzy.sort((a, b) => b[1] - a[1])
    return fuzzy[0][0]
  }

  // 5. 内置表里的模糊匹配
  for (const [name, meta] of META) {
    const words = [name, ...meta.alias].map(w => String(w).toLowerCase())
    if (words.some(w => w.includes(lower))) return name
  }
  return null
}
