# 日知 · 日有所记，知有所长

一个给自己使用的个人成长空间。清雅的暖白与苔绿界面，适配电脑和手机。长期主修默认是「人工智能与计算机」，也为其他领域保留探索窗口。

## 使用方式

1. 打开网站，点击「开启我的第一天」，设置昵称和至少 10 位的空间密码。
2. 在「今日」做三件小事：留住经历、收集一个新知、写一点自己的解释。忙碌时只写一句话。
3. 卡片从「待消化」到「在思考」，最终成为「能讲清」。最后一个阶段要求填写解释、证据和边界。
4. 到「回望与表达」回想旧卡片，每周写一段自己的见解。
5. 在「成长足迹」看累计记录、知识版图、里程碑和近半年热力图。

网页写作支持 Markdown 的标题、粗体、斜体、删除线、链接、引用、列表、待办、代码块与表格。每个正文栏可切换「编辑 / 对照 / 预览」，支持 Ctrl / ⌘ + B、I 格式快捷键，Ctrl / ⌘ + S 保存正式记录。原始 HTML 按文字显示；图片语法呈现为链接。

日记、知识笔记和周复盘在独立的「写作间」页面打开，地址为 `#write/journal/…`、`#write/entry/…` 或 `#write/weekly/…`。页面提供宽幅正文、笔记信息侧栏和顶部固定的保存、全文预览、Markdown 导出、返回按钮；手机上笔记信息移到正文下方。刷新写作地址后需重新登录，再恢复加密草稿；浏览器前进、后退也会保管未保存的草稿。仅回想、登录和删除确认等简短操作保留弹窗。

输入停顿约 700 毫秒后自动加密保存草稿，关闭编辑时也会提交草稿。每次新建独立分配草稿编号，互不覆盖；未完成内容集中列在导航中的「草稿箱」，可按标题、类型、更新时间和摘要找到，继续写、单篇导出或确认删除。空白写作页不产生草稿，新建入口不加载历史草稿。保存为正式记录成功后，只移出当前草稿；编辑正式记录的未保存修改不会提前覆盖原文。旧版草稿在登录或恢复备份时自动迁入草稿箱。草稿不计入成长统计；全量加密备份包含草稿，全量 Markdown 包含正式记录。

每篇日记、卡片和周复盘均可单独下载 `.md`，编辑时还可下载未正式保存的当前内容。文件名统一为：

```text
2026-11-25_知识笔记_理解注意力机制_导出-2026-11-26_15-30-01-123.md
2026-11-26_全量加密备份_昵称_导出-2026-11-26_15-30-01-123.vault.json
```

记录日期和导出时间分开，时间按北京时间精确到毫秒。自动清洗 Windows 非法字符、保留名、控制字符和末尾点，过长标题按 Unicode 字符截短。浏览器决定实际下载目录；重复下载由浏览器追加序号。`.md` 使用带 BOM 的 UTF-8，便于 Windows 本地打开。

详细的产品逻辑见 [docs/PRODUCT.md](docs/PRODUCT.md)。

## 密码、保存与同步

- 登录是当前设备上的**密码加密空间**，不是服务器账号。网站公开代码，私人数据不会提交到网站仓库。
- PBKDF2-SHA256（310,000 次迭代）派生 AES-256-GCM 密钥；每次保存使用随机 IV。密码和解密密钥不会写入浏览器持久存储。
- 默认数据加密保存在该浏览器 localStorage。刷新或闲置 15 分钟后需重新登录；**密码无法找回**。
- GitHub Pages 同一域名下的项目共享浏览器存储，因此使用独立存储键 `rizhi.v1.vault`。加密不能防御已经控制当前页面或设备的恶意程序。
- 清理网站数据、更换浏览器或换设备前，请到「空间设置」导出 `.vault.json` 加密备份。恢复时需要原密码。
- Markdown 导出为可读明文，适合私人归档。
- 可选跨设备同步：创建自己的**私有** GitHub 数据仓库（例如 `hblgzsx/rizhi-private`），创建只限此仓库且具有 Contents 读写权限的 fine-grained token，在空间设置中填写。令牌仅留在当前页面内存，锁定后清除。页面通过 HTTPS 直接请求 GitHub API；**绝不要把令牌提交到网站仓库**。
- 云端同步是显式上传、下载的**加密快照**，不自动合并。远端已有快照时，先下载恢复再上传；服务端 SHA 校验避免覆盖其他设备的新版本。下载恢复会替换本地空间，操作前先备份本地独有记录。新设备可先创建临时空空间，再下载云端快照并使用原密码恢复。
- 多标签页检测到外部更改会停止继续写入，要求重新登录。建议同一时间使用一个标签页编辑。

## 资讯

`scripts/fetch_news.py` 使用标准库抓取中国新闻网、arXiv cs.AI、Hacker News 的 RSS，仅存标题、链接、来源与原始日期。无模型总结，不虚构新闻。每个来源最多 6 条，抓取失败会标记并保留本地已有条目的原始日期。

GitHub Actions 计划在北京时间每日 07:20 / 13:20 / 19:20 触发刷新并部署，实际执行可能延迟。访问者不能在网页中强制触发 Actions。界面展示实际更新时间；公开资讯标题不等于事实核验，需阅读原文。

## 本地运行与验证

无需安装前端依赖。Node.js 22+，Python 3.9+。

```sh
npm run dev
npm test
python scripts/fetch_news.py
```

打开 `http://127.0.0.1:4173`。请使用 localhost 或 HTTPS，密码加密依赖 Web Crypto。GitHub Pages 部署只复制明确列出的网页文件与公开资讯，不包含备份、测试或开发脚本。

开发验证脚本 `scripts/check-ui.mjs` 覆盖实际浏览器写作、导出、恢复与移动布局，需要 Playwright 及 Chromium/Edge。可以用环境变量 `PLAYWRIGHT_MODULE` 和 `BROWSER_PATH` 指向本机安装。截图与测试下载仅放在已忽略的 `test-results/`。

## 发布

项目仓库：`https://github.com/hblgzsx/rizhi`

Pages 目标地址：`https://hblgzsx.github.io/rizhi/`

仓库 Settings → Pages → Source 选择 GitHub Actions。推送 main 或手动触发 `Publish 日知` 自动验证并发布。

在具备网络访问与 Git 写入权限、且已登录 hblgzsx 的 PowerShell 中，可从项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish.ps1
```

脚本先验证账号、测试和构建，再检查已有仓库、仅暂存明确列出的源文件、推送并启用 Pages，等待部署成功后检查 HTTP 响应。不会强推，不会上传 `test-results/` 或私人备份。验证情况见 [docs/VALIDATION.md](docs/VALIDATION.md)。

技术资料：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[GitHub 仓库内容 API](https://docs.github.com/en/rest/repos/contents)、[Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)。
