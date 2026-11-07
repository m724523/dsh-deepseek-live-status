## 新增插件 / New plugin

`dsh-deepseek-live-status` — 左侧栏底部的一行 DeepSeek 服务状态挂件。

One-line DeepSeek service widget at the sidebar footer: a status dot plus the live latency of four probes measured from this machine, with a popover showing official component statuses read from status.deepseek.com. Chinese by default, English when the host locale is `en`. No data is reported anywhere; probes only go out to those four public domains.

- 挂件：状态圆点 + 名称 + 四项探针（`api.deepseek.com`、`chat.deepseek.com`、`api-docs.deepseek.com`、`status.deepseek.com`）的本机实时延迟均值
- 点开弹出 288px 卡片：每项探针一行（状态点 / 名称 / 延迟），下面是官方公布的整体状态、组件数量与最近采样时间，以及官方状态页链接
- 官方数据读自 `status.deepseek.com` 页面内嵌载荷（该站没有公开 JSON API）：解析 `components` / `component_impacts` / `changes`，按「是否存在覆盖当前时刻的 impact」判定组件状态；解析不到就标未知，不会默认显示正常
- 自动刷新 15 秒 / 30 秒（默认）/ 1 分钟 / 2 分钟，选择存 `localStorage`
- Host 侧注册三条本机同源路由（`snapshot` / `refresh` / `config`），走 `connection.requestRejection()` 做来源校验，不新开端口；零运行时依赖、无构建脚本
- 不上报任何数据：探针只从本机发往上述四个公共域名

安装：

```sh
dsh plugin --profile web add github:m724523/dsh-deepseek-live-status
```

已在 DSH 0.2.1-rc.5（Windows）加载验证：挂件出现在侧栏底部、卡片正确定位在 `shell.overlay` 层、四项探针与官方 7 个组件解析正常。
