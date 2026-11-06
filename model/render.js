/** 视图对象 → PNG 图片（puppeteer 渲染，失败时由调用方回退文字） */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from '../config/config.js'
import { toHtml } from './card.js'
import { getRenderScale } from './settings.js'

let browserPromise = null
let idleTimer = null
let disabledReason = ''

async function loadPuppeteer () {
  // 优先从 Yunzai 根目录解析，兼容 pnpm 的严格依赖结构
  try {
    const requireFromRoot = createRequire(join(process.cwd(), 'package.json'))
    const resolved = requireFromRoot.resolve('puppeteer')
    const mod = await import(pathToFileURL(resolved).href)
    if (mod?.default) return mod.default
  } catch (err) { /* 继续尝试普通 import */ }

  try {
    const mod = await import('puppeteer')
    if (mod?.default) return mod.default
  } catch (err) { /* 落到下面的统一报错 */ }

  throw new Error('未安装 puppeteer（在 Yunzai 根目录执行 pnpm add puppeteer 后重启）')
}

async function getBrowser () {
  if (browserPromise) return browserPromise

  browserPromise = (async () => {
    const puppeteer = await loadPuppeteer()
    const options = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--font-render-hinting=none'
      ]
    }
    if (config.chromePath) options.executablePath = config.chromePath

    const browser = await puppeteer.launch(options)
    browser.on?.('disconnected', () => { browserPromise = null })
    return browser
  })()

  try {
    return await browserPromise
  } catch (err) {
    browserPromise = null
    throw err
  }
}

/** 提前确认 puppeteer 可用，避免先下载一堆头像才发现不能出图 */
export async function ensureRenderer () {
  if (disabledReason) throw new Error(disabledReason)
  await loadPuppeteer()
}

/** 渲染一张卡片，返回 PNG Buffer */
export async function renderView (view, avatars = new Map(), weaponIcons = new Map()) {
  if (disabledReason) throw new Error(disabledReason)

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    const width = Math.max(360, Number(view.width) || Number(config.imageWidth) || 720)
    const scale = getRenderScale(Number(config.renderScale) || 2)
    await page.setViewport({ width, height: 900, deviceScaleFactor: scale })
    await page.setContent(toHtml(view, avatars, weaponIcons), { waitUntil: 'load', timeout: 15000 })
    await page.evaluate(() => document.fonts?.ready).catch(() => {})
    const buffer = await page.screenshot({ fullPage: true, type: 'png' })
    return Buffer.from(buffer)
  } finally {
    await page.close().catch(() => {})
    touchIdle()
  }
}

/** 闲置一段时间后自动关闭浏览器，避免长期占用内存 */
function touchIdle () {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    idleTimer = null
    const current = browserPromise
    browserPromise = null
    current?.then(browser => browser?.close?.()).catch(() => {})
  }, 3 * 60 * 1000)
  idleTimer.unref?.()
}

/** 渲染失败后停用图片模式，避免每条指令都卡一次 */
export function disableImage (reason) {
  disabledReason = reason || '图片渲染不可用'
}

export function imageDisabled () {
  return !!disabledReason
}

export function resetImage () {
  disabledReason = ''
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (browserPromise) {
    browserPromise.then(browser => browser?.close?.()).catch(() => {})
    browserPromise = null
  }
}
