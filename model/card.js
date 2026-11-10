/** 视图对象 → 图片卡片的 HTML */
import fs from 'node:fs'
import { config } from '../config/config.js'
import { formatDuration } from './videos.js'

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

// 卡片背景图（放在 resources/bg.jpg，可自行替换；缺失时退回纯色渐变）
let BACKGROUND = ''
try {
  const buffer = fs.readFileSync(new URL('../resources/bg.jpg', import.meta.url))
  BACKGROUND = `data:image/jpeg;base64,${buffer.toString('base64')}`
} catch (err) { /* 没有背景图就用纯色 */ }

const CARD_BG = BACKGROUND
  ? `linear-gradient(180deg, rgba(8, 10, 15, 0.8) 0%, rgba(8, 10, 15, 0.88) 45%, rgba(8, 10, 15, 0.93) 100%), url("${BACKGROUND}")`
  : 'linear-gradient(155deg, #171b26 0%, #11141c 45%, #0d1016 100%)'

function esc (value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ESCAPE[ch])
}

const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

const HELP_ICONS = {
  user: svg('<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/>'),
  coin: svg('<circle cx="12" cy="12" r="7.5"/><path d="M9 8.8l3 3.2 3-3.2M12 12v4.5M9.5 13.2h5"/>'),
  swap: svg('<path d="M4 8h13l-3.2-3.2M20 16H7l3.2 3.2"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/>'),
  table: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M9.5 10v9"/>'),
  hash: svg('<path d="M9 4L7.2 20M16.8 4L15 20M4.5 9h15M4 15h15"/>'),
  trophy: svg('<path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3M12 12v4M9 20h6M10.5 16h3v4h-3z"/>'),
  crown: svg('<path d="M4 18h16M5 18l-1.2-9 5 3L12 5l3.2 7 5-3L19 18"/>'),
  leaf: svg('<path d="M20 4C10.5 4 4 9.5 4 16c0 2.2 1.3 4 3.4 4C14.6 20 20 13.3 20 4z"/><path d="M4.5 19.5C7.5 14 11.5 9.8 17 7"/>'),
  scale: svg('<path d="M12 3v18M7 21h10M4 8h16"/><path d="M4 8l-2 6h4L4 8zM20 8l-2 6h4l-2-6z"/>'),
  users: svg('<circle cx="9" cy="8" r="3"/><path d="M3 19c.6-3 2.9-5 6-5s5.4 2 6 5"/><path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 14.2c2 .7 3.2 2.4 3.5 4.8"/>'),
  play: svg('<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5l5.2 3.5L10 15.5z" fill="currentColor" stroke="none"/>'),
  download: svg('<path d="M12 3v11M7.5 10.5L12 15l4.5-4.5M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>'),
  sword: svg('<path d="M19 3l2 2-9.5 9.5-2.5.5.5-2.5L19 3z"/><path d="M8.5 15.5L5 19M3 21l2-2"/>'),
  alert: svg('<path d="M12 4L3 20h18L12 4z"/><path d="M12 10v4M12 17h.01"/>'),
  refresh: svg('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>'),
  link: svg('<path d="M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4"/>')
}

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #0b0d12; }
body {
  padding: 18px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "WenQuanYi Micro Hei", sans-serif;
  color: #e8eaf0;
  -webkit-font-smoothing: antialiased;
}
.card {
  position: relative;
  padding: 26px 26px 18px;
  border-radius: 20px;
  background-color: #0d1016;
  background-image: ${CARD_BG};
  background-size: cover;
  background-position: center 14%;
  background-repeat: no-repeat;
  border: 1px solid rgba(230, 200, 138, 0.22);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
.card::before {
  content: "";
  position: absolute;
  top: -120px; right: -80px;
  width: 260px; height: 260px;
  background: radial-gradient(circle, rgba(230, 200, 138, 0.14), transparent 68%);
  pointer-events: none;
}
.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.brand { font-size: 12px; letter-spacing: 2.5px; color: #e6c88a; font-weight: 700; }
.brand span { color: #6b7385; font-weight: 500; letter-spacing: 1px; margin-left: 8px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #e6c88a; box-shadow: 0 0 12px #e6c88a; }
h1 { font-size: 30px; line-height: 1.25; font-weight: 800; letter-spacing: 0.5px; }
h1 .suffix { color: #e6c88a; font-size: 20px; font-weight: 700; margin-left: 6px; }
.sub { margin-top: 6px; font-size: 13px; color: #8b93a7; }
.stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.stat {
  flex: 0 0 auto; min-width: 108px;
  padding: 10px 14px; border-radius: 12px;
  background: rgba(230, 200, 138, 0.06);
  border: 1px solid rgba(230, 200, 138, 0.16);
}
.stat .k { font-size: 11px; color: #8b93a7; letter-spacing: 0.5px; }
.stat .v { font-size: 20px; font-weight: 800; color: #f2dfae; margin-top: 3px; }
.stat .s { font-size: 11px; color: #6b7385; margin-left: 4px; font-weight: 500; }
section { margin-top: 22px; }
h2 {
  font-size: 13px; font-weight: 700; letter-spacing: 1.2px; color: #cbb27c;
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
h2::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(230, 200, 138, 0.25), transparent); }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.tile {
  padding: 9px 11px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.tile .k { font-size: 11px; color: #8b93a7; }
.tile .v { font-size: 16px; font-weight: 700; margin-top: 2px; color: #e8eaf0; }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.055); }
.row:last-child { border-bottom: none; }
.rank { width: 30px; flex: 0 0 30px; text-align: center; font-size: 17px; font-weight: 800; color: #e6c88a; }
.rank.n { color: #6b7385; }
.body { flex: 1; min-width: 0; }
.primary { font-size: 15px; font-weight: 600; line-height: 1.45; word-break: break-all; }
.el { font-size: 11px; color: #9fb3d1; background: rgba(120, 155, 210, 0.14); border-radius: 6px; padding: 1px 6px; margin-left: 6px; vertical-align: 1px; }
.meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 5px; }
.pill {
  font-size: 11px; color: #e6c88a; padding: 2px 8px; border-radius: 999px;
  background: rgba(230, 200, 138, 0.1); border: 1px solid rgba(230, 200, 138, 0.22);
}
.pill em { font-style: normal; color: #9d8f6b; margin-left: 4px; }
.tag { font-size: 11px; padding: 2px 7px; border-radius: 999px; }
.tag.green { color: #7fd79b; background: rgba(111, 208, 140, 0.1); border: 1px solid rgba(111, 208, 140, 0.25); }
.tag.red { color: #ff9a9a; background: rgba(255, 122, 122, 0.1); border: 1px solid rgba(255, 122, 122, 0.25); }
.link { font-size: 11px; color: #7f8ea6; }
.team { margin-top: 4px; font-size: 11.5px; color: #6f7a8e; }
.value { flex: 0 0 auto; text-align: right; font-size: 20px; font-weight: 800; color: #f2dfae; letter-spacing: 0.3px; }
.value small { display: block; font-size: 10px; color: #6b7385; font-weight: 500; letter-spacing: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: right; font-size: 13px; padding: 8px 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
th { font-size: 11px; color: #8b93a7; font-weight: 600; letter-spacing: 0.5px; }
th:first-child, td:first-child { text-align: left; }
td:first-child { color: #e6c88a; font-weight: 600; }
td { color: #dfe3ec; }
tr:last-child td { border-bottom: none; }
.note { font-size: 13px; color: #b9c0ce; line-height: 1.8; }
.notes { margin-top: 16px; font-size: 11px; color: #6b7385; line-height: 1.9; }
.foot { margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; justify-content: space-between; font-size: 11px; color: #5f6779; }
.help-wrap { display: flex; flex-direction: column; gap: 16px; margin-top: 20px; }
.help-head { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 10px; }
.help-head i { width: 4px; height: 15px; border-radius: 2px; background: var(--c); box-shadow: 0 0 10px var(--c); }
.help-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.help-card {
  display: flex; gap: 9px; padding: 10px; border-radius: 11px;
  background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.055);
}
.help-icon {
  width: 30px; height: 30px; flex: 0 0 30px; display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; border-radius: 9px;
  background: rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.08);
}
.help-icon svg { width: 17px; height: 17px; display: block; }
.help-text { min-width: 0; }
.help-cmd {
  font-family: "Cascadia Code", Consolas, "Courier New", monospace; font-size: 12px; color: #f2dfae;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.help-desc { margin-top: 3px; font-size: 11px; color: #8b93a7; line-height: 1.4; }
.help-card .help-cmd { font-weight: 600; }
.card.help-mode { background-position: center 10%; }
.hero { display: flex; align-items: center; gap: 16px; }
.hero-avatar {
  width: 76px; height: 76px; flex: 0 0 76px;
  border-radius: 20px; object-fit: cover; object-position: center 20%;
  border: 2px solid rgba(230, 200, 138, 0.45);
  background: #1b2030;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
}
.hero-text { min-width: 0; }
.members { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.member { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 600; color: #dfe4ee; }
.member em { font-style: normal; font-size: 10px; font-weight: 600; color: #9d8f6b; margin-left: 1px; letter-spacing: 0.2px; }
.ava {
  width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%;
  object-fit: cover; object-position: center 20%;
  background: #232a3a; border: 1px solid rgba(230, 200, 138, 0.35);
}
.ava.fallback { display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #cbb27c; }
.primary .ava { width: 26px; height: 26px; flex-basis: 26px; display: inline-block; vertical-align: -7px; margin-right: 7px; }
.primary .ava.fallback { vertical-align: -7px; }
.tier { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.055); }
.tier:last-child { border-bottom: none; }
.tier-cost { flex: 0 0 84px; }
.tier-cost .pill { font-size: 12px; padding: 3px 9px; white-space: nowrap; }
.tier-dps { flex: 0 0 92px; text-align: right; font-size: 18px; font-weight: 800; color: #f2dfae; letter-spacing: 0.3px; }
.tier-team { flex: 1; min-width: 0; }
.tier-team .member { font-size: 13px; gap: 4px; }
.tier-team .members { gap: 3px 10px; }
.tier-count { flex: 0 0 56px; text-align: right; font-size: 11px; color: #6b7385; line-height: 1.5; }
.tier-count span { display: block; font-size: 10px; color: #4f5768; }
.wrow { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.055); }
.wrow:last-child { border-bottom: none; }
.wavatar {
  width: 46px; height: 46px; flex: 0 0 46px; border-radius: 12px;
  object-fit: cover; object-position: center 20%;
  border: 1px solid rgba(230, 200, 138, 0.35); background: #1b2030;
}
.wavatar.fallback { display: flex; align-items: center; justify-content: center; font-size: 16px; color: #cbb27c; }
.wbody { flex: 1; min-width: 0; }
.wtop { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; }
.wtag { font-size: 11px; font-weight: 500; color: #8b93a7; background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 1px 6px; }
.wweapon { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 13px; color: #cfd6e3; }
.wicon { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 6px; object-fit: contain; background: rgba(255, 255, 255, 0.04); }
.wicon.fallback { display: inline-flex; align-items: center; justify-content: center; color: #cbb27c; font-size: 13px; }
.wweapon em {
  font-style: normal; font-size: 10px; color: #e6c88a; padding: 1px 6px; border-radius: 999px;
  background: rgba(230, 200, 138, 0.1); border: 1px solid rgba(230, 200, 138, 0.2);
}
.wmeta { font-size: 11px; color: #6b7385; }
.vrow { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.055); }
.vrow:last-child { border-bottom: none; }
.vcover {
  position: relative; width: 132px; height: 74px; flex: 0 0 132px;
  border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #232a3a, #161b26);
  border: 1px solid rgba(255, 255, 255, 0.07);
}
.vcover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vcover .play { color: #e6c88a; font-size: 22px; opacity: 0.75; }
.vdur {
  position: absolute; right: 5px; bottom: 4px; font-size: 10px; color: #fff;
  background: rgba(0, 0, 0, 0.65); border-radius: 5px; padding: 0 4px; line-height: 1.5;
}
.vbody { flex: 1; min-width: 0; }
.vtitle {
  font-size: 14px; font-weight: 600; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.vmeta { margin-top: 4px; font-size: 12px; color: #9aa3b5; }
.vmeta b { color: #f2dfae; font-weight: 700; margin-right: 6px; }
.vlink { margin-top: 3px; font-size: 11px; color: #7f8ea6; word-break: break-all; }
`

function statHtml (stat) {
  return `<div class="stat"><div class="k">${esc(stat.label)}</div>` +
    `<div class="v">${esc(stat.value)}${stat.sub ? `<span class="s">${esc(stat.sub)}</span>` : ''}</div></div>`
}

function costPill (cost) {
  if (!cost) return ''
  return `<span class="pill">${esc(cost.label)}${cost.sub ? `<em>${esc(cost.sub)}</em>` : ''}</span>`
}

function avatarHtml (name, avatars, className = 'ava') {
  const uri = avatars?.get(name)
  if (uri) return `<img class="${className}" src="${uri}" alt="">`
  const initial = esc(String(name || '?').slice(0, 1))
  return `<span class="${className} fallback">${initial}</span>`
}

function membersHtml (members, avatars) {
  return members.map(m => {
    const cons = m.cons > 0 ? `<em>C${m.cons}</em>` : ''
    return `<span class="member">${avatarHtml(m.name, avatars)}<span>${esc(m.name)}</span>${cons}</span>`
  }).join('')
}

function rowHtml (item, avatars) {
  const rankClass = item.rank <= 3 ? 'rank' : 'rank n'
  let primary
  if (item.members?.length) {
    primary = `<div class="members">${membersHtml(item.members, avatars)}</div>`
  } else if (item.name) {
    primary = `${avatarHtml(item.name, avatars)}${esc(item.name)}${item.el ? `<span class="el">${esc(item.el)}</span>` : ''}`
  } else {
    primary = esc(item.team)
  }

  const meta = []
  if (item.cost) meta.push(costPill(item.cost))
  if (item.ver) meta.push(`<span class="pill">v${esc(item.ver)}</span>`)
  for (const tag of item.tags || []) {
    meta.push(`<span class="tag ${tag === '绿玩' ? 'green' : 'red'}">${esc(tag)}</span>`)
  }
  if (item.link) meta.push(`<span class="link">▶ ${esc(item.link)}</span>`)

  const teamLine = item.name && item.team ? `<div class="team">${esc(item.team)}</div>` : ''

  const value = esc(item.value)

  return `<div class="row">
    <div class="${rankClass}">${esc(['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'][item.rank - 1] || `${item.rank}.`)}</div>
    <div class="body">
      <div class="primary">${primary}</div>
      ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
      ${teamLine}
    </div>
    <div class="value">${value}</div>
  </div>`
}

function stygianRowHtml (item, avatars) {
  const members = (item.members || []).map(m => {
    const cons = m.cons > 0 ? `<em>${m.cons}</em>` : ''
    return `<div class="smember">
      <span class="sava-wrap">${avatarHtml(m.name, avatars, 'sava')}${cons}</span>
      <span class="sname">${esc(m.name)}</span>
    </div>`
  }).join('')
  const costLabel = item.costText || item.cost?.label
  const cost = costLabel ? `<b>${esc(costLabel)}</b><span>金数</span>` : ''
  const time = item.value ? `<b>${esc(item.value)}</b><span>用时</span>` : ''
  const star = (item.tags || []).includes('命星') ? '<i class="sstar">命星</i>' : ''
  const href = item.video || (item.link ? `https://www.bilibili.com/video/${item.link}` : '')
  const play = href
    ? `<a class="splay" href="${esc(href)}">▶</a>`
    : '<span class="splay empty"></span>'
  return `<div class="srow">
    <div class="srank ${item.rank <= 3 ? '' : 'n'}">${esc(item.rank)}</div>
    <div class="smembers">${members}</div>
    <div class="scost">${cost}${star}</div>
    <div class="stime">${time}</div>
    ${play}
  </div>`
}

function sectionHtml (section, avatars, weaponIcons = new Map(), layout = '') {
  if (section.type === 'curve') {
    const tiles = section.items.map(item => `<div class="tile">
      <div class="k">${esc(item.label)}${item.sub ? ` ${esc(item.sub)}` : ''}</div>
      <div class="v">${esc(item.value)}</div>
    </div>`).join('')
    return `<section><h2>${esc(section.title)}</h2><div class="grid">${tiles}</div></section>`
  }

  if (section.type === 'rows') {
    if (layout === 'stygian') {
      return `<section class="stygian">${section.items.map(item => stygianRowHtml(item, avatars)).join('')}</section>`
    }
    return `<section>${section.title ? `<h2>${esc(section.title)}</h2>` : ''}${section.items.map(item => rowHtml(item, avatars)).join('')}</section>`
  }

  if (section.type === 'table') {
    const head = `<tr>${section.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`
    const body = section.items.map(item => `<tr>${item.cells.map((cell, i) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
    return `<section>${section.title ? `<h2>${esc(section.title)}</h2>` : ''}<table>${head}${body}</table></section>`
  }

  if (section.type === 'tiers') {
    const rows = section.items.map(item => `<div class="tier">
      <div class="tier-cost">${costPill(item.cost)}</div>
      <div class="tier-dps">${esc(item.value)}</div>
      <div class="tier-team"><div class="members">${membersHtml(item.members, avatars)}</div></div>
      ${item.count ? `<div class="tier-count">${esc(item.count)}${item.median ? `<span>中位 ${esc(item.median)}</span>` : ''}</div>` : ''}
    </div>`).join('')
    return `<section>${section.title ? `<h2>${esc(section.title)}</h2>` : ''}${rows}</section>`
  }

  if (section.type === 'weapons') {
    const rows = section.items.map(item => {
      const weapon = item.weapon
      const iconUri = weapon?.icon ? weaponIcons.get(weapon.icon) : ''
      const icon = iconUri ? `<img class="wicon" src="${iconUri}" alt="">` : '<span class="wicon fallback">⚔</span>'
      const weaponLine = weapon
        ? `${icon}<span>${esc(weapon.name)}</span>${weapon.refine ? `<em>R${weapon.refine}</em>` : ''}` +
          `<span class="wmeta">${weapon.level ? `Lv.${weapon.level} · ` : ''}★${weapon.rank}${weapon.type ? ` ${esc(weapon.type)}` : ''}</span>`
        : `${icon}<span>未展示武器</span>`

      return `<div class="wrow">
        <div class="rank ${item.rank <= 3 ? '' : 'n'}">${esc(['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'][item.rank - 1] || `${item.rank}.`)}</div>
        ${avatarHtml(item.name, avatars, 'wavatar')}
        <div class="wbody">
          <div class="wtop">
            <span>${esc(item.name)}</span>
            ${item.el ? `<span class="el">${esc(item.el)}</span>` : ''}
            <span class="wtag">Lv.${item.level}</span>
            ${item.cons ? `<span class="wtag">C${item.cons}</span>` : ''}
          </div>
          <div class="wweapon">${weaponLine}</div>
        </div>
      </div>`
    }).join('')
    return `<section>${section.title ? `<h2>${esc(section.title)}</h2>` : ''}${rows}</section>`
  }

  if (section.type === 'videos') {
    const rows = section.items.map(item => {
      const video = item.video || {}
      const cover = video.cover
        ? `<img src="${video.cover}" alt="">`
        : '<span class="play">▶</span>'
      const duration = video.duration ? `<span class="vdur">${esc(formatDuration(video.duration))}</span>` : ''
      const costSub = item.cost?.sub ? `<span> ${esc(item.cost.sub)}</span>` : ''
      const cost = item.cost ? `${esc(item.cost.label)}${costSub}` : ''
      const link = video.bvid
        ? `▶ ${esc(video.bvid)}${video.author ? ` · ${esc(video.author)}` : ''}`
        : esc(video.url || '')

      return `<div class="vrow">
        <div class="rank ${item.rank <= 3 ? '' : 'n'}">${esc(['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'][item.rank - 1] || `${item.rank}.`)}</div>
        <div class="vcover">${cover}${duration}</div>
        <div class="vbody">
          <div class="vtitle">${esc(video.title || '未获取到标题')}</div>
          <div class="vmeta"><b>${esc(item.dps)}</b>${cost} · ${esc(item.team)}</div>
          <div class="vlink">${link}</div>
        </div>
      </div>`
    }).join('')
    return `<section>${section.title ? `<h2>${esc(section.title)}</h2>` : ''}${rows}</section>`
  }

  if (section.type === 'pairs') {
    const head = `<tr><th>金数</th>${section.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`
    const body = section.items.map(item => `<tr><td>${esc(item.label)}</td>${item.values.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')
    return `<section>${section.title ? `<h2>${esc(section.title)}</h2>` : ''}<table>${head}${body}</table></section>`
  }

  if (section.type === 'help') {
    const groups = section.groups.map(group => `<section class="help-group">
      <div class="help-head" style="--c:${group.color || '#e6c88a'}"><i></i>${esc(group.title)}</div>
      <div class="help-grid">
        ${group.items.map(item => `<div class="help-card">
          <div class="help-icon" style="color:${group.color || '#e6c88a'}">${HELP_ICONS[item.icon] || esc(item.icon || '•')}</div>
          <div class="help-text">
            <div class="help-cmd">${esc(item.cmd)}</div>
            <div class="help-desc">${esc(item.desc)}</div>
          </div>
        </div>`).join('')}
      </div>
    </section>`).join('')
    return `<div class="help-wrap">${groups}</div>`
  }

  if (section.type === 'note') {
    return `<section class="note">${section.lines.map(line => `<div>${esc(line)}</div>`).join('')}</section>`
  }

  return ''
}

const LIGHT_CSS = `
.card.light {
  background: #eef1f8; color: #2b3040;
  border: none; box-shadow: 0 12px 34px rgba(40, 60, 110, 0.14);
  padding: 22px 18px 14px;
}
.card.light .top { justify-content: center; margin-bottom: 6px; }
.card.light .brand { color: #8a94ad; font-weight: 600; letter-spacing: 2px; }
.card.light .brand span { display: none; }
.card.light .dot { display: none; }
.card.light h1 { text-align: center; font-size: 26px; color: #232838; font-weight: 800; }
.card.light .sub { text-align: center; color: #8f98ad; font-size: 12px; margin-top: 4px; }
.card.light section.stygian { margin-top: 14px; }
.srow {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border-radius: 16px; padding: 10px 12px; margin-bottom: 8px;
  box-shadow: 0 4px 14px rgba(40, 60, 110, 0.06);
}
.srank { width: 26px; flex: 0 0 26px; text-align: center; font-size: 20px; font-weight: 800; color: #e8503a; }
.srank.n { color: #b9c0d0; }
.smembers { flex: 1; display: flex; gap: 10px; min-width: 0; }
.smember { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 52px; }
.sava-wrap { position: relative; display: block; width: 40px; height: 40px; }
.sava {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center 18%;
  background: #e3e8f4; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(40,60,110,.18);
}
.sava.fallback { display: flex; align-items: center; justify-content: center; font-size: 16px; color: #6b7690; }
.sava-wrap em {
  position: absolute; right: -3px; bottom: -3px; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px; background: #5b6b8c; color: #fff; font-style: normal;
  font-size: 10px; line-height: 16px; text-align: center; font-weight: 700;
}
.sname { font-size: 10.5px; color: #4d566d; white-space: nowrap; }
.scost, .stime { flex: 0 0 52px; text-align: center; }
.scost b { display: block; font-size: 16px; color: #e0a52e; font-weight: 800; }
.stime b { display: block; font-size: 16px; color: #3f7fd9; font-weight: 800; }
.scost span, .stime span { font-size: 9.5px; color: #9aa3b6; }
.sstar { display: block; font-style: normal; font-size: 9px; color: #57b06a; margin-top: 2px; }
.splay {
  flex: 0 0 30px; width: 30px; height: 30px; border-radius: 50%;
  background: #2f8ef0; color: #fff; font-size: 12px; line-height: 30px; text-align: center;
  text-decoration: none; box-shadow: 0 3px 8px rgba(47,142,240,.35);
}
.splay.empty { background: #dfe4ef; box-shadow: none; }
.card.light .foot { border-top: none; justify-content: center; color: #a2aabb; font-size: 10.5px; margin-top: 10px; }
.card.light .notes { color: #9aa3b6; text-align: center; }
.card.light .notes div { display: inline-block; margin: 0 6px; }
`

export function toHtml (view, avatars = new Map(), weaponIcons = new Map()) {
  const width = Math.max(360, Number(view.width) || Number(config.imageWidth) || 720)
  const stats = view.stats?.length ? `<div class="stats">${view.stats.map(statHtml).join('')}</div>` : ''
  const sections = (view.sections || []).map(section => sectionHtml(section, avatars, weaponIcons, view.layout || '')).join('')
  const notes = view.notes?.length
    ? `<div class="notes">${view.notes.map(note => `<div>· ${esc(note)}</div>`).join('')}</div>`
    : ''
  const foot = view.footer
    ? `<div class="foot"><span>数据来源 ${esc(view.footer.source)} ｜ 共 ${esc(view.footer.count)}</span><span>${esc(view.footer.time)} 更新</span></div>`
    : ''

  const sub = view.subtitle ? `<div class="sub">${esc(view.subtitle)}</div>` : ''
  const heroAvatar = view.avatarName ? avatars.get(view.avatarName) : ''
  const titleBlock = heroAvatar
    ? `<div class="hero"><img class="hero-avatar" src="${heroAvatar}" alt=""><div class="hero-text"><h1>${esc(view.title)}</h1>${sub}</div></div>`
    : `<h1>${esc(view.title)}</h1>${sub}`

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>${CSS}${view.theme === 'light' ? LIGHT_CSS : ''}</style></head>
<body style="width:${width}px"><div class="card${view.help ? ' help-mode' : ''}${view.theme === 'light' ? ' light' : ''}">
  <div class="top"><div class="brand">MHYDPS.CN<span>原神 DPS 数据库</span></div><div class="dot"></div></div>
  ${titleBlock}
  ${stats}
  ${sections}
  ${notes}
  ${foot}
</div></body></html>`
}
