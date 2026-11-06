/** 视图对象 → 纯文字消息（图片渲染失败时的兜底） */
import { mark } from './view.js'
import { formatDuration } from './videos.js'

function costText (cost) {
  if (!cost) return ''
  return cost.sub ? `${cost.label}(${cost.sub})` : cost.label
}

function renderRows (section, lines) {
  for (const item of section.items) {
    const head = item.name
      ? `${mark(item.rank - 1)} ${item.name}${item.el ? `(${item.el})` : ''} ${item.value}`
      : `${mark(item.rank - 1)} ${item.value}`
    const parts = [head]
    const cost = costText(item.cost)
    if (cost) parts.push(cost)
    if (item.team) parts.push(item.team + (item.tags?.length ? ` [${item.tags.join('/')}]` : ''))
    lines.push(parts.join(' ｜ '))
    if (item.link) lines.push(`　　BV：${item.link}`)
  }
}

export function toText (view) {
  const lines = [`▎${view.title}`]
  if (view.subtitle) lines.push(view.subtitle)
  if (view.stats?.length) {
    lines.push(view.stats
      .map(s => (s.sub ? `${s.label} ${s.value}（${s.sub}）` : `${s.label} ${s.value}`))
      .join(' ｜ '))
  }

  for (const section of view.sections) {
    if (section.title) {
      lines.push('', `◈ ${section.title}`)
    } else {
      lines.push('')
    }

    if (section.type === 'curve') {
      const cells = section.items.map(i => {
        const cost = i.sub ? `${i.label}(${i.sub})` : i.label
        return `${cost} ${i.value}`
      })
      for (let i = 0; i < cells.length; i += 2) {
        lines.push(cells.slice(i, i + 2).join(' · '))
      }
    } else if (section.type === 'rows') {
      renderRows(section, lines)
    } else if (section.type === 'table') {
      for (const item of section.items) {
        const cells = item.cells
        if (cells.length === 4) {
          lines.push(`${cells[0]} ｜ 最高 ${cells[1]} ｜ 中位 ${cells[2]} ｜ ${cells[3]}`)
        } else {
          lines.push(cells.join(' ｜ '))
        }
      }
    } else if (section.type === 'tiers') {
      for (const item of section.items) {
        const parts = [costText(item.cost), item.value, item.team]
        if (item.count) parts.push(item.count)
        lines.push(parts.join(' ｜ '))
      }
    } else if (section.type === 'weapons') {
      for (const item of section.items) {
        const weapon = item.weapon
          ? `武器：${item.weapon.name}${item.weapon.refine ? ` R${item.weapon.refine}` : ''}` +
            `${item.weapon.level ? ` Lv.${item.weapon.level}` : ''}` +
            `${item.weapon.rank ? `（★${item.weapon.rank}${item.weapon.type ? ` ${item.weapon.type}` : ''}）` : ''}`
          : '未展示武器'
        lines.push(
          `${mark(item.rank - 1)} ${item.name}${item.el ? `(${item.el})` : ''}` +
          ` Lv.${item.level}${item.cons ? ` C${item.cons}` : ''} ｜ ${weapon}`
        )
      }
    } else if (section.type === 'videos') {
      for (const item of section.items) {
        const tags = item.tags?.length ? ` [${item.tags.join('/')}]` : ''
        lines.push(`${mark(item.rank - 1)} ${item.dps} ｜ ${costText(item.cost)} ｜ ${item.team}${tags}`)
        const video = item.video || {}
        if (video.title || video.author || video.duration) {
          const meta = [
            video.title,
            video.author ? `UP：${video.author}` : '',
            video.duration ? formatDuration(video.duration) : ''
          ].filter(Boolean).join(' · ')
          lines.push(`　　${meta}`)
        }
        if (video.bvid) lines.push(`　　https://www.bilibili.com/video/${video.bvid}`)
        else if (video.url) lines.push(`　　${video.url}`)
      }
    } else if (section.type === 'pairs') {
      for (const item of section.items) {
        const parts = [item.label]
        section.head.forEach((head, i) => parts.push(`${head} ${item.values[i] ?? '—'}`))
        lines.push(parts.join(' ｜ '))
      }
    } else if (section.type === 'help') {
      section.groups.forEach((group, index) => {
        if (index > 0) lines.push('')
        lines.push(`◈ ${group.title}`)
        for (const item of group.items) lines.push(`${item.cmd} ─ ${item.desc}`)
      })
    } else if (section.type === 'note') {
      lines.push(...section.lines)
    }
  }

  if (view.notes?.length) {
    lines.push('')
    for (const note of view.notes) lines.push(`· ${note}`)
  }

  if (view.footer) {
    if (lines[lines.length - 1] !== '') lines.push('')
    lines.push('────────────')
    lines.push(`数据来源 ${view.footer.source} ｜ 共 ${view.footer.count} ｜ ${view.footer.time} 更新`)
  }

  return lines.join('\n')
}
