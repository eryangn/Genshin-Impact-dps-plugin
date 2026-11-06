# Genshin Impact dps-plugin · 原神 DPS 查询

[![version](https://img.shields.io/badge/version-2.4.2-e6c88a)](https://github.com/eryangn/Genshin-Impact-dps-plugin)
[![license](https://img.shields.io/badge/license-MIT-3da639)](LICENSE)
[![Yunzai](https://img.shields.io/badge/Yunzai-Bot-7fb4ff)](https://github.com/eryangn/Genshin-Impact-dps-plugin)

基于 [mhydps.cn（原神 DPS 数据库）](https://www.mhydps.cn) 的 Yunzai 插件。数据实时来自站点，支持图片卡片、角色头像、绿玩过滤与视频下载。

## ✨ 功能

### 📊 DPS 查询
- **角色总览**：最高 DPS、金均、各金数最佳配队（四名角色 + 头像 + 命座）
- **角色 + 金数**：指定金数下该角色的全部队伍
- **全站各金数最佳配队**：0~12 金 + 满配，一图看完每档最强队
- **金数统计表**：各档最高 / 中位 DPS / 队伍数
- **金数排行**：任意 0~48 金的队伍排行
- **全站排行**：总榜 / 指定金数
- **角色榜**：每个主 C 的最高 DPS
- **绿玩角色榜**：只看无宏成绩
- **双角色对比**：逐金数对比 DPS
- **配队查询**：同时包含指定角色的队伍

### 🎬 配队视频
- **视频列表**：B 站封面、标题、UP 主、时长、BV 号
- **序号查看单条**：`#dps视频 甘雨 #2`
- **下载并发送视频**：`#dps视频下载 甘雨 #2`（默认仅主人）

### 🗡️ 账号练度
- **UID 武器查询**：账号展示角色的武器 / 精炼 / 等级 / 图标（Enka 数据）

### 🎨 展示与体验
- 图片卡片 + 角色头像 + 自定义背景（`resources/bg.jpg`）
- 双金数标注（总金数 / 限定金）
- 绿玩 / 宏标记与过滤、参考视频链接
- 帮助页三列模板，视频序号查单条
- 主人可调渲染精度（`#dps精度 1~3`）
- 图片渲染失败自动回退文字，所有卡片都有文字版
- 数据缓存、重复投稿去重、站点接口失败自动回退 Supabase

### ⚙️ 数据
- 来源：mhydps.cn 公开接口 `/api/teams`、`/api/teams2`
- 金数 = 限定金 + 常驻金，48 金为满配
- 首次拉取约 700KB，默认缓存 30 分钟

---

## 一、安装

### 方式一：git clone（推荐）

在 Yunzai 根目录执行，不需要先 `cd plugins`：

```bash
git clone --depth=1 https://github.com/eryangn/Genshin-Impact-dps-plugin.git plugins/Genshin-Impact-dps-plugin
```

也可以用安装脚本（同样在 Yunzai 根目录执行）：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/eryangn/Genshin-Impact-dps-plugin/main/install.sh)
```

克隆完成后目录结构应为 `Yunzai/plugins/Genshin-Impact-dps-plugin/dps.js`。

之后更新插件：

```bash
git -C plugins/Genshin-Impact-dps-plugin pull
```

### 方式二：下载压缩包

把整个 `Genshin-Impact-dps-plugin` 文件夹放进 Yunzai 根目录的 `plugins/` 下，重启 Yunzai 即可：

```
Yunzai/
└── plugins/
    └── Genshin-Impact-dps-plugin/
        ├── dps.js                # 插件入口（指令注册）
        ├── package.json
        ├── config/
        │   └── config.js         # 可修改配置
        └── model/
            ├── api.js            # 数据接口（站点接口 + 备用接口）
            ├── store.js          # 缓存、去重、聚合
            ├── view.js           # 查询结果 → 视图数据
            ├── text.js           # 视图 → 文字
            ├── card.js           # 视图 → HTML 卡片
            ├── render.js         # HTML → PNG（puppeteer）
            ├── avatars.js        # 角色头像（站点资源 → data URI 缓存）
            ├── characters.js     # 角色名 / 别名解析
            └── character-data.js # 角色别名表
```

> `dps.js` 必须位于 `plugins/Genshin-Impact-dps-plugin/` 第一层，Yunzai 才会加载到它。

重启 Yunzai 后发送 `#dps帮助` 验证安装（首次使用会拉取全量数据，约 1~2 秒）。

### 卡片背景

卡片背景图在 `resources/bg.jpg`，直接替换成自己的图即可（建议宽度 900px 左右、200KB 以内，会以 data URI 内嵌渲染）；删除该文件则退回纯色渐变背景。

### 图片模式依赖（可选）

图片卡片依赖 Yunzai 环境里的 `puppeteer`：

```bash
# 在 Yunzai 根目录执行
pnpm add puppeteer
# 或 npm i puppeteer
```

- 已有 puppeteer 的 Yunzai（多数整合包自带）无需额外操作。
- 服务器上没有自动下载浏览器时，可在 `config/config.js` 里用 `chromePath` 指定本机 Chromium/Chrome/Edge 路径。
- 没装 puppeteer、或渲染报错时，插件会**自动改用文字输出**，不会影响查询；想直接用文字可把 `image` 设为 `false`。

Linux 服务器如果不是中文环境，建议装一下中文字体（否则卡片上的汉字可能是方块）：

```bash
apt install fonts-noto-cjk        # Debian / Ubuntu
```

---

## 二、指令

| 指令 | 说明 |
| --- | --- |
| `#dps帮助`（或 `#dps`） | 指令菜单 |
| `#dps 玛薇卡` | 角色总览：最高 DPS、金均、各金数最佳 DPS 曲线、顶尖队伍 |
| `#dps 玛薇卡 4` | 该角色在 4 金时的队伍 |
| `#dps金数表` | 全站各金数：最高 / 中位 DPS / 队伍数 |
| `#dps各金数` | **每个金数档位的最佳配队**（DPS + 四名角色 + 中位） |
| `#dps金数 8` | 8 金队伍 DPS 排行（0 ~ 48） |
| `#dps金数 玛薇卡 4` | 角色 + 金数（等价 `#dps 玛薇卡 4`） |
| `#dps排行` | 全站 DPS 排行 Top10 |
| `#dps排行 8` | 指定金数的全站排行 |
| `#dps角色榜` | 主 C 角色 DPS 排行（每个角色只取一次最高） |
| `#dps绿玩榜` | **绿玩（无宏）角色 DPS 排行**，可加金数：`#dps绿玩榜 4` |
| `#dps角色榜 4` | 4 金下的主 C 角色排行 |
| `#dps对比 玛薇卡 阿蕾奇诺` | 两名角色逐金数对比 |
| `#dps队伍 玛薇卡 班尼特` | 同时包含这些角色的队伍 |
| `#dps武器 <UID> [角色]` | 查账号展示角色的武器（名称 / 精炼 / 等级），例 `#dps武器 618285856` |
| `#dps 甘雨视频 [金数]` | 该角色带视频的配队，附 B 站标题/封面/UP主，也可写 `#dps视频 甘雨 4` |
| `#dps视频 甘雨 #2` | 按序号查看单条视频（也支持 `2号`、`第2`，可叠加金数：`#dps视频 甘雨 4 #1`） |
| `#dps视频下载 甘雨 #2` | 下载并发送视频文件（默认仅主人，360P，约 10~30 秒） |
| `#dps危战` | 危战竞速榜（用时越短越强） |
| `#dps危战 4` | 指定金数的危战榜 |
| `#dps危战金数` | 危战按金数分档排行，每档取最快记录 |
| `#dps危战金数 8` | 指定金数的危战金数排行（前 30） |
| `#dps各金数最高` | 每个金数只取最高 DPS 的一览表 |
| `#dps更新` | 立即刷新数据缓存（仅机器人主人） |
| `#dps插件更新` | 从仓库拉取最新插件代码（仅主人，重启后生效） |
| `#dps精度 [数值]` | 调整图片渲染倍率 1~3（仅主人），如 `#dps精度 1.5`、`#dps精度 重置` |
| `#dps链接` | 官网地址 |

### 修饰词

指令结尾可以追加修饰词，可组合：

| 修饰词 | 作用 | 示例 |
| --- | --- | --- |
| `绿玩` / `无宏` | 只统计绿玩（无宏）成绩 | `#dps排行 8 绿玩` |
| `文字` | 这次强制用文字输出 | `#dps 玛薇卡 文字` |

### 其他说明

- `#` 可省略，`#dps` 与 `#原神dps` 等价。
- 角色名支持别名 / 简称（已合并 Mys-plugin 的角色别名表）：`雷神` → 雷电将军、`龟` → 神里绫华、`水龙` → 那维莱特、`草神` → 纳西妲，也支持 `神里 绫华` 这种被空格分开的写法。
- 金数同时标注总金数与限定金：`8金(限6)` 表示 8 金里 6 金是限定；48 金显示为满配。

---

## 三、配置

编辑 `config/config.js`：

| 配置项 | 默认 | 说明 |
| --- | --- | --- |
| `cacheMinutes` | `30` | 数据缓存分钟数，到期自动重新拉取 |
| `image` | `true` | 是否输出图片卡片（失败自动回退文字） |
| `imageWidth` | `720` | 卡片宽度（CSS 像素） |
| `renderScale` | `2` | 渲染倍率 1~3，实际宽度 = imageWidth × renderScale；主人可用 `#dps精度` 运行时调整 |
| `chromePath` | `''` | 自定义 Chromium 路径，留空用 puppeteer 自带浏览器 |
| `listLimit` | `10` | 排行榜类指令默认条数 |
| `topTeams` | `3` | 角色总览展示的顶尖队伍数量 |
| `videoCount` | `3` | 前 N 条队伍附带参考视频（0 = 不显示） |
| `videoDownload` | `true` | 是否允许 `#dps视频下载` 发送视频文件 |
| `videoDownloadMasterOnly` | `true` | 是否只有主人能触发视频下载 |
| `videoQuality` | `16` | 下载清晰度 qn：16=360P / 32=480P / 64=720P |
| `videoMaxMB` | `30` | 视频大小上限，超过则拒绝下载 |
| `avatar` | `true` | 卡片上是否显示角色头像 |
| `cleanOnly` | `false` | 是否全局只看绿玩记录 |
| `onlyConfirmed` | `true` | 是否只统计已审核记录 |
| `timeout` | `20000` | 单次请求超时（毫秒） |

改完保存后发送 `#dps更新` 即可生效，不需要重启。

`#dps精度` 的调整结果会写入 Redis（键 `mhydps:settings`），重启后保留；Redis 不可用时只在本次运行生效。

---

## 四、数据说明

- 数据来自 mhydps.cn 的公开只读接口：`/api/teams`（DPS 配队）与 `/api/teams2`（危战竞速）；
  站点接口异常时自动回退到其 Supabase 公开接口。
- `DPS` 数值为站点收录值（站点页面展示的口径），插件原样展示，不做二次换算。
- 金数 = 限定金 + 常驻金，48 金即满配；记录中的 `limitcost` 会作为「限定金」单独标注。
- 同一份成绩被重复投稿时会自动去重，只保留排名最高的一条。
- 首次查询会拉取全量数据（约 700 KB），之后走内存缓存。
- 角色头像取自站点 `https://www.mhydps.cn/charactor/<角色ID>.webp`，首次使用时下载并转为 data URI 缓存（同一角色 24 小时内不重复下载）；头像获取失败会用角色首字占位，不影响出图。
- `#dps武器` 走 Enka 公开角色展示接口（优先站点同源代理），需要玩家在游戏内开启「显示角色详情」；武器中文名来自内置武器数据表（按 itemId 映射），图标取自 Enka 公共资源，缺失时用 ⚔ 占位。
- `#dps 角色视频` 会调用 B 站公开接口补全标题 / 封面 / UP主 / 时长（1 小时缓存），封面压缩为 480×270 后内嵌；接口失败时只显示 BV 号与链接。

---

## 五、常见问题

**图片发不出来 / 变成文字**
说明当前环境没有可用的 puppeteer 或 Chromium，插件已自动降级为文字。想恢复图片：在 Yunzai 根目录 `pnpm add puppeteer`，或配置 `chromePath` 指向本机浏览器，然后重启。

**头像没显示 / 显示成首字圆圈**
头像来自 mhydps.cn，可能是网络不通或该角色没有对应资源；插件会自动用首字占位。不想要头像可把 `avatar` 设为 `false`。

**卡片里的中文是方块**
服务器缺少中文字体，安装 `fonts-noto-cjk` 后重启机器人。

**查询失败 / 超时**
服务器访问 mhydps.cn 失败，多为网络问题。可先在服务器上执行
`curl -H "Referer: https://www.mhydps.cn/" https://www.mhydps.cn/api/teams` 检查连通性。

**`#dps视频下载` 发不出视频**
默认走公开接口取 360P（`videoQuality` 可调），文件超过 `videoMaxMB` 会直接拒绝；同时依赖 QQ 适配器支持视频消息（icqq 的 `segment.video`），发送失败时会回退成「标题 + 链接」。下载的临时文件会在 2 分钟后自动删除。

**`#dps武器` 查不到数据**
需要玩家在游戏内开启「显示角色详情」；Enka 公开接口主要覆盖国际服 / 亚服 / 欧美服，国服 UID 能否查到取决于 mhydps 代理是否支持，查不到时会提示「没有公开的角色展示数据」。

**识别不到某个角色**
先发 `#dps角色榜` 看收录情况；新角色可在 `model/character-data.js` 里补一条
`['角色名', ['别名1', '别名2'], 5, 'Pyro', 10000xxx],`（最后一项是角色 ID，用于头像），保存后 `#dps更新`。

**消息/图片太长**
把 `listLimit`、`topTeams` 调小，或加 `文字` 用纯文本。

---

## 六、免责声明

数据及版权归 mhydps.cn 与各位投稿者所有，本插件仅做查询与展示，请勿用于商业用途。
