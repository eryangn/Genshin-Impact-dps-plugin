/**
 * mhydps-plugin 配置
 * 修改后保存，并发送「#dps更新」即可生效（无需重启）
 */
export const config = {
  /** 数据缓存时间（分钟），到期后下次查询自动重新拉取；默认一天 */
  cacheMinutes: 1440,

  /** 是否输出图片卡片（需要 Yunzai 环境里装有 puppeteer；渲染失败会自动回退为文字） */
  image: true,

  /** 图片卡片宽度（CSS 像素） */
  imageWidth: 720,

  /**
   * 渲染精度（输出倍率）：1 省流 / 1.5 / 2 默认 / 3 高清
   * 主人可用 #dps精度 <数值> 在运行时调整，调整结果优先于此项
   */
  renderScale: 2,

  /**
   * 自定义 Chromium 路径（留空则使用 puppeteer 自带的浏览器）
   * 例：'/usr/bin/chromium' 或 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
   */
  chromePath: '',

  /** 列表类指令默认展示多少条（排行统一 30 条） */
  listLimit: 30,

  /** 角色总览里展示的顶尖队伍数量 */
  topTeams: 30,

  /** 前 N 条队伍附带参考视频链接（0 = 不显示） */
  videoCount: 3,

  /** #dps 角色视频 一次最多展示多少条 */
  videoLimit: 8,

  /** 是否允许机器人下载并发送视频文件（#dps视频下载） */
  videoDownload: true,

  /** 是否只有主人才能发送视频文件（防刷流量，建议开启） */
  videoDownloadMasterOnly: true,

  /** 下载清晰度 qn：16=360P / 32=480P / 64=720P（未登录一般只能取到 360P/720P） */
  videoQuality: 16,

  /** 视频文件大小上限（MB），超过会拒绝下载 */
  videoMaxMB: 30,

  /**
   * B 站登录 Cookie（可选）
   * 填了之后视频查询/下载都用你的账号，412 更少，也能拿更高清晰度
   * 格式：SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx
   */
  biliCookie: 'SESSDATA=12917176%2C1809753792%2C14b99%2Ab2CjCSW6AMp5-jhaq8E9QfA40JvOjVe7tfHbU-WrKFYkv99AraUEde8cdCRHF3D2hyP3USVmpkUWhRWWc0aThrcFJMRnp1ZXZKRVZobHJxZUVudk5rUHhibDlYTmU3LS1YdUxKdjNXT3paNWthSTNsWFJ1LS1ZVkp0TnBBMktiRXpxdG5MQ2p2cHJRIIEC',

  /** 卡片上是否显示角色头像（取自站点，加载失败自动用首字占位） */
  avatar: true,

  /** 是否只统计绿玩（无宏）记录 */
  cleanOnly: false,

  /** 是否只统计已审核（confirm=true）的记录 */
  onlyConfirmed: true,

  /** 查询超时时间（毫秒） */
  timeout: 20000
}
