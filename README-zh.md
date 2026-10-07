# 拾页 · 小说推荐工具

用户搜索或手动添加喜欢的小说，系统归纳共同标签并推荐其他作品。每条推荐都关联一本喜好作品并解释共同元素。推荐会排除已经添加的小说。

## 当前版本

- 16 本中文小说的起步书库、20 个阅读元素。
- 搜索书名、作者，或者手动添加作品并选择 1–6 个标签。
- 喜好保存在 D1 数据库，以平台提供的登录用户 ID 隔离；刷新、再次登录后可以继续使用。
- 按标签相似性、偏好权重及同作者加分排序。少见的共同标签权重更高。
- 不使用大模型、不调用实时书库或排行榜。标签、简介为人工整理，契合程度不代表作品质量评分。界面封面为本站排版。
- 数据库异常不会伪装为成功保存；输入保留并显示可重试错误。

## 本地运行

需要 Node.js 22.13+。在本目录运行：

```powershell
npm run install:ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_*.sql
npm run dev
```

迁移命令需填写实际生成的 SQL 文件名，按顺序执行且不重复已应用的迁移。本地预览地址以终端输出为准。访问 `/signin-with-chatgpt?return_to=/` 可使用开发环境的模拟用户；模拟登录不会包含在生产构建中。

```powershell
node --experimental-strip-types --test tests/recommendations.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

在启动构建后的本地 Worker（`npm start`）之后，用 PowerShell 7 运行 `./tests/api.integration.ps1`。通过 `NOVEL_TEST_ORIGIN` 指定终端打印的本地地址（默认 `http://127.0.0.1:8787`）。该测试仅允许 localhost，使用随机测试用户并在结束时清理自己的记录，验证鉴权、保存、用户隔离、输入校验和移除。开发预览的登录模拟会主动剥离伪造身份头，因此该集成测试应针对构建后的本地 Worker 运行。

## 结构

- `components/novel-finder.tsx`：界面、搜索和书单交互。
- `lib/novels.ts`：书库、偏好画像、推荐排序与理由。
- `lib/favorite-input.ts`：输入验证与书名去重。
- `app/api/favorites/route.ts`：读取、添加、移除喜好；服务端鉴权。
- `db/schema.ts` 与 `drizzle/`：数据库定义与版本化迁移。

后续可扩展正版平台书目数据和语义检索。更大书库需要取得数据来源的使用授权并完善作品标识；目前仅提供推荐与作品介绍，不提供小说正文。

