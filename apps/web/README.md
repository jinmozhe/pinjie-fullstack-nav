# apps/web

C 端用户前端，基于 Next.js App Router。

## 技术栈

- Next.js（App Router，`output: standalone`）
- React 19 + TypeScript + Tailwind CSS
- lucide-react
- TanStack Query v5 + Zustand
- @pinjie/api-client（自动生成 SDK）

## 本地启动

```powershell
pnpm install
pnpm --filter @pinjie/web dev   # http://localhost:3000
```

浏览器请求使用同域 `/api/v1`，Next.js Route Handler 在服务端转发到 `BACKEND_INTERNAL_URL`。

独立 `/x` 页面需要先初始化根 `data/x-sites.json`，并在 `.env.local` 配置服务端绝对路径 `X_SITES_FILE`；后续修改 JSON 后刷新生效。完整步骤与文件校验命令见[JSON 维护手册](../../docs/operations/x-navigation-json.md)。

## 生产部署模式

使用 `output: standalone` 容器模式。容器部署默认不依赖进程内 ISR 缓存；派生项目需要增量缓存时，必须先设计共享缓存、失效和恢复策略。

## 当前范围

当前已实现业务中立首页和系统状态、注册、登录、SSR 用户中心、资料、密码、会话、退出和注销流程，并覆盖加载、错误和不可用状态。商品、购物车、结算等具体业务 Feature 由派生仓库按计划添加。

## 质量检查

```powershell
pnpm --filter @pinjie/web lint
pnpm --filter @pinjie/web typecheck
pnpm --filter @pinjie/web test
pnpm --filter @pinjie/web build
```
