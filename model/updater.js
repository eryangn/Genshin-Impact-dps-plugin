/**
 * 插件自身更新
 *
 * #dps插件更新（仅主人）
 * - 从 jsDelivr / fastly / raw 读取 main 分支 package.json 的版本号
 * - 有新版本时下载仓库 zip（codeload → github → ghproxy 回退）
 * - 解压覆盖插件文件，保留 data/ 与 config/config.js（用户配置）
 * - 覆盖前把旧文件备份到 data/plugin-backup/<版本>-<时间>/
 * - 更新后需要重启 Yunzai 才会加载新代码
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REPO = 'eryangn/Genshin-Impact-dps-plugin'
const VERSION_URLS = [
  `https://cdn.jsdelivr.net/gh/${REPO}@main/package.json`,
  `https://ghproxy.114514616.xyz/https://raw.githubusercontent.com/${REPO}/main/package.json`,
  `https://fastly.jsdelivr.net/gh/${REPO}@main/package.json`,
  `https://raw.githubusercontent.com/${REPO}/main/package.json`
]
const ZIP_URLS = [
  `https://codeload.github.com/${REPO}/zip/refs/heads/main`,
  `https://github.com/${REPO}/archive/refs/heads/main.zip`,
  `https://ghproxy.114514616.xyz/https://github.com/${REPO}/archive/refs/heads/main.zip`
]
const KEEP = new Set(['data', 'node_modules', '.git'])
const KEEP_FILES = new Set(['config/config.js'])

function compareVersion (a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

async function fetchBuffer (url, timeout = 60000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'mhydps-plugin-updater' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson (urls) {
  let best = null
  let lastError
  for (const url of urls) {
    try {
      const sep = url.includes('?') ? '&' : '?'
      const pkg = JSON.parse((await fetchBuffer(`${url}${sep}t=${Date.now()}`, 15000)).toString('utf8'))
      if (!pkg.version) continue
      if (!best || compareVersion(pkg.version, best.version) > 0) best = pkg
    } catch (err) {
      lastError = err
    }
  }
  if (best) return best
  throw lastError || new Error('无法获取版本信息')
}

async function downloadZip () {
  let lastError
  for (const url of ZIP_URLS) {
    try {
      const buffer = await fetchBuffer(url, 90000)
      if (buffer.length < 1000) throw new Error('文件过小')
      return buffer
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('下载失败')
}

/** 解析 zip 中央目录（只支持 store / deflate，足够 GitHub 归档） */
function unzip (buffer) {
  let eocd = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('不是有效的 zip 文件')

  const count = buffer.readUInt16LE(eocd + 10)
  let off = buffer.readUInt32LE(eocd + 16)
  const entries = []

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(off) !== 0x02014b50) throw new Error('zip 中央目录异常')
    const method = buffer.readUInt16LE(off + 10)
    const compSize = buffer.readUInt32LE(off + 20)
    const nameLen = buffer.readUInt16LE(off + 28)
    const extraLen = buffer.readUInt16LE(off + 30)
    const commentLen = buffer.readUInt16LE(off + 32)
    const localOff = buffer.readUInt32LE(off + 42)
    const name = buffer.toString('utf8', off + 46, off + 46 + nameLen)
    off += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue

    const lNameLen = buffer.readUInt16LE(localOff + 26)
    const lExtraLen = buffer.readUInt16LE(localOff + 28)
    const start = localOff + 30 + lNameLen + lExtraLen
    const raw = buffer.subarray(start, start + compSize)
    entries.push({
      name,
      data: method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw)
    })
  }
  return entries
}

function safeRelative (name, prefix) {
  let rel = name.startsWith(prefix) ? name.slice(prefix.length) : name
  rel = path.posix.normalize(rel)
  if (rel.startsWith('..') || path.posix.isAbsolute(rel)) return null
  if (!rel || rel === '.') return null
  const top = rel.split('/')[0]
  if (KEEP.has(top)) return null
  if (KEEP_FILES.has(rel)) return null
  return rel
}

export async function updatePlugin () {
  const localPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const remotePkg = await fetchJson(VERSION_URLS)
  const current = localPkg.version || '0.0.0'
  const latest = remotePkg.version || current

  if (compareVersion(latest, current) <= 0) {
    return { updated: false, message: `当前已是最新版本 v${current}` }
  }

  const buffer = await downloadZip()
  const entries = unzip(buffer)
  const rootName = entries[0]?.name.split('/')[0] || ''
  const prefix = rootName ? `${rootName}/` : ''

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(ROOT, 'data', 'plugin-backup', `${current}-${stamp}`)
  await backup(backupDir)

  let written = 0
  for (const entry of entries) {
    const rel = safeRelative(entry.name, prefix)
    if (!rel) continue
    const target = path.join(ROOT, rel)
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, entry.data)
    written++
  }

  await fs.promises.writeFile(
    path.join(ROOT, 'data', 'plugin-update.json'),
    JSON.stringify({ from: current, to: latest, at: new Date().toISOString(), files: written }, null, 2),
    'utf8'
  )

  return {
    updated: true,
    message: `插件已更新 v${current} → v${latest}（${written} 个文件）\n请重启 Yunzai 生效`
  }
}

/** 备份旧插件文件（不含 data/ 等），失败不影响更新 */
async function backup (dir) {
  try {
    await fs.promises.mkdir(dir, { recursive: true })
    const walk = async (src, rel = '') => {
      for (const item of await fs.promises.readdir(src, { withFileTypes: true })) {
        if (KEEP.has(item.name)) continue
        const from = path.join(src, item.name)
        const to = path.join(dir, rel, item.name)
        if (item.isDirectory()) {
          await walk(from, path.join(rel, item.name))
        } else {
          await fs.promises.mkdir(path.dirname(to), { recursive: true })
          await fs.promises.copyFile(from, to)
        }
      }
    }
    await walk(ROOT)
  } catch (err) { /* 备份失败继续更新 */ }
}
