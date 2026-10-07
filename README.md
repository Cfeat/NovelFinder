# 拾页 · NovelFinder

本地运行的中文小说推荐工具。添加喜欢的小说、选择阅读元素，获取具体作品推荐和可核查的推荐理由。界面采用红黑导航、分类侧栏和紧凑书目布局。

## 功能

- 书名／作者搜索，分类与平台筛选，书目分页。
- 喜好书架、主动偏好、屏蔽元素、已读与“不感兴趣”反馈。
- 相似作品和同作者匹配，多样性重排，三种可调探索模式。
- 显示推荐理由、公开信息来源及采集时间。
- 书单和反馈保存在浏览器，可导出 JSON 备份。
- 本地书目缓存、手动书源更新和晋江公开书名搜索。

## 技术栈

TypeScript、React 19、Vinext／Vite、Tailwind CSS、Radix UI；通过 Cloudflare 本地模拟器使用 D1／SQLite 缓存。正常开发和运行不需要云端账号、数据库凭据或 ChatGPT 登录。

## 快速开始

需要 Node.js **22.13+** 和 npm。进入包含 `package.json` 的项目目录：

```powershell
npm run install:ci
npm run dev
```

默认地址为 `http://127.0.0.1:5173/`；端口占用时以终端输出为准。浏览器喜好书架和初始书库可以直接使用。

首次启用增量缓存和平台搜索，需要构建并初始化本地数据库：

```powershell
npm run build
node --import ./scripts/local-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_faulty_captain_marvel.sql
node --import ./scripts/local-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_chilly_hedge_knight.sql
```

迁移按顺序执行，每个文件只执行一次。迁移中保留旧版表结构，便于已有本地数据库兼容；当前喜好保存在浏览器，旧服务端登录与喜好接口已移出项目。

```powershell
npm start
```

该命令运行构建后的本地 Worker，默认地址为 `http://127.0.0.1:8787/`。`dev` 和 `start` 都监听 127.0.0.1；以上命令不发布网站。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发与热更新 |
| `npm test` | 书目解析、输入、推荐和本地画像测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run build` | 本地构建 |
| `npm start` | 运行构建后的本地应用 |
| `npm run db:generate` | 根据 schema 生成新数据库迁移 |

## 推荐机制

流程为：候选匹配 → 过滤 → 评分 → 多样性重排 → 推荐理由。

评分综合加权标签相似度、整体偏好、主动偏好和同作者信号；排除喜欢、已读、不感兴趣及包含屏蔽元素的作品。平衡模式每 6 个位置尝试 1 个探索候选，多探索模式每 3 个位置尝试 1 个，候选不足时保留匹配结果。

具体参数和平台公开机制研究见 [推荐机制说明](docs/recommendation.md)。当前没有协同过滤、全文分析或阅读时长预测；匹配分不代表作品质量或喜欢概率。

## 书库和持续更新

2026-10-07 的初始快照包含 757 条公开书目，与 16 本人工作品合并后为 **771 本**。实际书库数量以界面为准。

| 平台 | 初始公开书目数 | 覆盖情况 |
| --- | ---: | --- |
| 番茄小说 | 47 | 首页公开推荐和更新列表 |
| 晋江文学城 | 500 | 作品库前 5 页；支持按需书名搜索 |
| 纵横中文网 | 180 | 首页和 5 个分类页 |
| 17K 小说网 | 30 | 第 1 页成功，后续页访问验证 |
| 起点中文网 | 0 | 公开书库访问验证，未成功入库 |
| 七猫中文网 | 0 | 访问验证或网络失败，未成功入库 |

- 在“书源与覆盖”中点击“检查书源更新”，每个平台至少间隔 1 小时；失败时保留已有缓存。
- 晋江搜索由用户主动触发，结果加入本地缓存；搜索冷却 10 秒。
- 手动添加喜好仅用于个人画像，不会录入公共书库。
- 暂无定时自动更新、公共书库批量导入或跨设备书单同步。
- 更新适配器只读取配置的有限页面，反复更新不等于获取全量书库。

如需重新生成初始快照：

```powershell
node --experimental-strip-types scripts/sync-public-catalog.mjs
```

该脚本会替换 `data/public-catalog.json`，不是数据库增量更新。至少一个来源成功才写入；部分平台失败时新快照可能缺少该平台记录，运行后应先审查数据差异，再执行测试和构建。

## 目录

```text
app/                    页面与本地书库 API
components/             推荐界面及实际使用的 UI 组件
lib/                    推荐、画像校验、书源解析与去重
build/worker.ts         本地 Worker 入口源码
scripts/                本地运行环境与书目快照脚本
db/                     数据库访问与 schema
drizzle/                版本化迁移及 Drizzle 元数据
data/public-catalog.json 初始公开书目快照
docs/                   推荐机制研究
public/                 图标
vendor/                 所需第三方样式及许可声明
tests/                  自动化测试
```

`build/` 包含必要源码，不能当作构建产物排除；生成结果位于 `dist/`。Drizzle 的 `meta/` 和 `package-lock.json` 也需要提交，以便后续迁移和依赖安装可复现。

## GitHub 提交范围

提交源码、配置、锁文件、迁移、测试、公开书目快照和文档。`.gitignore` 排除了依赖、构建结果、编译缓存、本地数据库、环境文件、日志、源码压缩包、本地备份及旧托管绑定。

上传目录应为本项目目录，父目录中的预览截图和旧压缩包不需要上传。GitHub 保存源码不会自动发布网站；项目没有自动部署工作流，运行约束见 [AGENTS.md](AGENTS.md)。

提交前检查：

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git status --short
git diff --cached --stat
```

`.gitignore` 不会清除旧提交历史。若只需要公开当前源码，可使用整理后的源码包创建新仓库；源码包不含 `.git`、历史记录、数据库或个人书单。

## 数据与第三方文件

书目来自平台公开页面，只包含元数据和简介摘录，不包含小说正文或付费章节。标签由公开分类／标签映射或人工整理，不代表全文分析；平台页面变化、访问限制和下架都会影响覆盖，详情以原站为准。

书单保存在当前浏览器，清除站点数据会丢失书单，请先导出备份。第三方样式与 UI 组件的许可声明保留在 [vendor/](vendor/)；它们不构成整项目或平台书目数据的许可声明。
