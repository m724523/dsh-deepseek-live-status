# 发布清单（纯网页版，不装任何工具）

目标：让插件出现在 DSH 插件市场。市场只认两样东西 —— 一个带 `dsh-plugin` topic 的 GitHub 仓库，加上收录列表里的一条 YAML。**npm 可以完全跳过**（列表里大量条目的 `npm` 是 null，映射由 CI 采集）。

先把 `dsh-deepseek-live-status/` 里这三处占位符换成你自己：

- `package.json`：`<GITHUB_USER>` ×3、`<YOUR NAME>` ×1
- `LICENSE`：`<YOUR NAME>` ×1
- `market/awesome-entry.yml`：`<GITHUB_USER>` ×2

## 1. 建仓库（30 秒）

<https://github.com/new> → Repository name: `dsh-deepseek-live-status` → Public → **不要**勾 Add a README / .gitignore / license → Create repository

## 2. 传文件（拖一次）

仓库页点 **uploading an existing file**，把 `I:\CPython 3.14\dsh-deepseek-status` 里的这些一起拖进去（拖整个文件夹也行，别把 `.shots`、`scripts` 拖上去）：

- `package.json`、`cordis.patch.yml`、`index.mjs`、`host.mjs`、`client.js`
- `icon.svg`、`LICENSE`、`README.md`、`screenshots.json`
- `locale/zh.json`、`locale/en.json`、`docs/card.png`、`docs/sidebar-widget.png`

Commit message 随便写，比如 `dsh-deepseek-live-status 0.1.0`。

## 3. 加 topic（必须）

仓库首页右侧 About → 齿轮 → Topics 填 `dsh-plugin` → Save。

## 4. 等满 1 天

收录 CI 会查仓库年龄（`MIN_AGE_DAYS = 1`），刚建的仓库提 PR 会被拒。只卡这一步，其它都能提前做完。

## 5. 提收录 PR（网页完成）

1. 打开 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> → **Fork**
2. 在自己 fork 里：**Add file → Create new file**
3. 文件名：`data/plugins/<你的用户名>__dsh-deepseek-live-status.yml`
4. 内容：粘贴 `market/awesome-entry.yml`（记得已换成你的用户名）
5. **Propose changes** → **Create pull request**，正文贴 `market/PR-body.md`

PR 规则：一个 PR 最多 3 条、别改生成出来的 README、只允许 `url`/`name`/`category`/`description`/`tarball` 五个键、描述会被拿去和代码逐条核对。

## 6. 合并后

站点重建、`plugins.json` 次日刷新，市场里就能搜到。别人装的时候：

```sh
dsh plugin --profile web add github:<你的用户名>/dsh-deepseek-live-status
```

## 想用命令行的话

这台机器装了 Git（`C:\Program Files\Git\cmd\git.exe`），但没有 `gh`。所以命令行版是：

```powershell
$env:Path += ";C:\Program Files\Git\cmd"
cd "I:\CPython 3.14\dsh-deepseek-status"
git init -b main; git add -A; git commit -m "dsh-deepseek-live-status 0.1.0"
git remote add origin https://github.com/<你的用户名>/dsh-deepseek-live-status.git
git push -u origin main
```

首次 push 会弹浏览器登录（Git Credential Manager）。仓库仍要先在网页上建好，PR 那一步还是走网页。
