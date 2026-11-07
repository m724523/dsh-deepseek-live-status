# dsh-deepseek-live-status

DSH 插件：左侧栏底部一个单行小挂件 —— 状态圆点 + `DeepSeek` + 最新平均延迟，点一下在它上方弹出 288px 宽的小卡片，看四项探针与官方状态。

## 它监测什么

两组数据并排显示，因为它们回答的是两个不同的问题：

**1. 本机实时探针（更贴近你的真实体验）**

以固定节奏（默认 60 秒）从本机请求下面这些目标，记录 DNS 解析耗时、首字节延迟、HTTP 状态：

| 目标 | 地址 | 判定 |
| --- | --- | --- |
| API 接口 | `https://api.deepseek.com/v1/models` | 不带凭据请求，401 也说明接口在线；5xx 记降级/中断 |
| 网页对话 | `https://chat.deepseek.com/` | 网页入口可访问性 |
| 官方状态页 | `https://status.deepseek.com/` | 页面可访问性，同时用于读取官方状态 |
| 开发者文档 | `https://api-docs.deepseek.com/` | 文档站可访问性 |

每个目标保留最近 120 次采样，用来算可达率、成功率、p50/p95 和一条延迟走势。

**2. 官方状态（status.deepseek.com）**

该站点**没有公开 JSON API**——`/api/v2/summary.json` 之类的标准路径全是 404，数据只在页面自身携带。所以插件读取页面正文，从 Next.js flight 载荷里还原三张表：`components`（7 个组件）、`component_impacts`（每个组件的历史影响区间，`start_at_seconds` / `end_at_seconds` / `status`）、`changes`（事故与维护标题及其状态）。

某个组件当前有没有问题，按「是否存在覆盖当前时刻的 impact」判定；没有就是 `operational`，和官方页自己的口径一致。抽不到就标「未知」，不会因为「页面能打开」就显示正常。

这正是它对「官方数据不太准」的处理方式：官方页不测线路、不测你所在地区、也不报厂家没承认的问题；本机探针测的是你此刻到底连不连得上。

## 装了什么

- Host 半（`host.mjs`）：定时采样，注册三条本机路由
  - `GET /api/dsh-deepseek-live-status/snapshot` 返回缓存快照
  - `POST /api/dsh-deepseek-live-status/refresh` 立即跑一轮采样后返回快照
  - `POST /api/dsh-deepseek-live-status/config` 改后台采样节奏（`{ "intervalMs": 30000 }`，钳制 15s–900s，写入 `$DSH_HOME/deepseek-status.json`）
  - 走 `ctx.get('connection').requestRejection()` 做来源校验，不新开监听端口。
- 浏览器半（`client.js`）：注册 `sidebar.footer.action`（`id = dsh-deepseek-live-status`，Settings 上方一行）与 `shell.overlay` 里的卡片；卡片带 `pointer-events: auto`，通过 `getBoundingClientRect()` 定位到挂件正上方。只复用宿主主题变量，不加载其它 Client 包。

## 安装

直接从 GitHub 装（不需要 npm，也不需要等收录）：

```sh
dsh plugin --profile web add github:m724523/dsh-deepseek-live-status

# 锁到某个提交
dsh plugin --profile web add github:m724523/dsh-deepseek-live-status#249af92

# 或用完整地址
dsh plugin --profile web add https://github.com/m724523/dsh-deepseek-live-status
```

装完重启 `dsh web`（新的客户端模块要重新扫描才会进浏览器清单），侧栏底部就会出现那一行挂件。

从本地目录装（开发时）：

```sh
dsh plugin --profile web add ./dsh-deepseek-live-status
```

要求 DSH `>= 0.2.1-rc.5`（见 `package.json` 的 `engines.dsh`）。零运行时依赖、没有 `prepare`/`build` 脚本，所以不会触发构建脚本授权。

## 可调项

环境变量（Host 启动时读取）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DSH_DEEPSEEK_STATUS_INTERVAL_MS` | `60000` | 采样间隔，钳制在 15s–900s |
| `DSH_DEEPSEEK_STATUS_TIMEOUT_MS` | `9000` | 单次请求超时，钳制在 1.5s–30s |
| `DSH_DEEPSEEK_STATUS_URL` | `https://status.deepseek.com/` | 官方页地址，可换镜像/代理入口 |

## 自动刷新

卡片里「自动刷新」下拉：15 秒 / 30 秒（默认）/ 1 分钟 / 2 分钟。5 分钟以上就不叫实时监测了，所以不再提供；早先存过 5/10 分钟的值仍会在下拉里显示，方便改回来。

选中的值存在 `localStorage`（键 `dsh-deepseek-live-status.refreshSeconds`），刷新页面、重启都保留。每次到点前端发一次 `POST /refresh` 强制跑一轮四项探针，所以数据是即时更新，不是等后台节奏。最小 15 秒——再快没有信息量，还容易吃上游限流。

Host 另有一条后台采样节奏（默认 60 秒，`DSH_DEEPSEEK_STATUS_INTERVAL_MS` 可调），负责在卡片关闭时也保持走势连续；下拉改变时会顺带 `POST /config` 让它跟随，这条要 Host 重启后才生效，不重启也不影响你在卡片里选的值。

## 发布

包名 `dsh-deepseek-live-status`（npm 上已确认可用）。旧的 `dsh-deepseek-status` 这个名字属于别人的同类插件（`KekuKase/dsh-deepseek-status`，做会话头部面板），别撞。

### 发 npm

```sh
# 先把 package.json 里的 <GITHUB_USER> / <YOUR NAME> 换成你自己
npm pack --dry-run          # 确认打进包的文件清单
npm publish --access public
```

`repository` 必须指回被收录的仓库，市场靠它把 npm 包和 GitHub 条目关联起来。

不发 npm 的替代方案：把 `npm pack` 出来的 tgz 挂到 GitHub Release，资产名不带版本号，条目里加
`tarball: https://github.com/<owner>/<repo>/releases/latest/download/<name>.tgz`。

### 上 GitHub

```sh
git init -b main && git add -A && git commit -m "dsh-deepseek-live-status 0.1.0"
gh repo create <owner>/dsh-deepseek-live-status --public --source . --remote origin --push
gh repo edit <owner>/dsh-deepseek-live-status --add-topic dsh-plugin
```

仓库根目录就是插件目录（`package.json` 与 `cordis.patch.yml` 必须在根），`dsh-plugin` topic 是硬要求，仓库还要**创建满 1 天**才能提收录 PR。

### 提收录 PR

市场的列表不在 dshmarket 仓库里，而是 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的 `data/plugins/*.yml`，一个插件一个文件：

```yaml
url: https://github.com/<owner>/dsh-deepseek-live-status
name: <owner>/dsh-deepseek-live-status
category: ui
description:
  en: 'Sidebar footer widget that shows DeepSeek service health: a status dot plus the live latency of four probes (API, chat, docs, status page) run from this machine, with a popover listing official component statuses read from status.deepseek.com. Refresh cadence 15s-2min.'
  zh: '左侧栏底部的一行状态挂件：绿点加本机四项探针（API、网页、文档、状态页）的实时延迟，点开弹出卡片看官方组件状态。刷新间隔 15 秒到 2 分钟可选。'
```

文件名必须等于 URL 的 slug（`owner__repo`），只允许 `url` / `name` / `category` / `description` / `tarball` 五个键，一个 PR 最多 3 条，不要手改生成的 README。分类为 `ui` 最贴切；描述会被评审拿去和代码逐条核对，别写没有的功能。

合并后站点重建、`plugins.json` 每日刷新，市场里就能搜到，安装命令形如
`dsh plugin --profile web add github:<owner>/dsh-deepseek-live-status`。

## 兼容性

- 声明 `engines.dsh: ">=0.1.0-rc.5"`。
- 代码里对老版本做了降级，不会因为缺服务而抛错：
  - 没有 `slots` 服务：插件静默不加载，Host 侧探针照常跑（`/api/dsh-deepseek-live-status/snapshot` 仍可用）。
  - 没有 `locale` 服务：入口标题退化成固定的 `DeepSeek`。
  - 没有 `shell.overlay`（旧版没有这个浮层）：卡片改由底部那一行自己渲染 —— 位置可能被侧栏裁掉一部分，但功能和数据都在。
  - `connection.requestRejection` 不存在时：路由不做来源校验（与更早的插件行为一致）。
- `sidebar.footer.action` 从 0.1.x 就有，是这行的落点；如果某个更老的版本连它都没有，插件不会显示任何东西，也不会报错。

## 已知限制

- 官方页面的内嵌结构变了一次就会解析失败；此时官方卡片降级成「页面可达 + 未识别」，本机探针照常工作。
- 只统计本次 Host 运行期间的样本，重启后清零。
- 探针是主动请求，间隔过密没有意义；15 秒以下会被钳制。
