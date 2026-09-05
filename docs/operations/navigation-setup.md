# 导航功能启用

## 前提

源码能力与当前会话边界见[导航架构](../architecture/navigation.md)。Backend、PostgreSQL、Redis 和原管理员帐号必须已按[本地环境手册](local-dev-environment.md)配置。

本任务只交付源码、迁移文件和轻量门禁结果，未执行真实迁移、权限同步、build、pytest、Vitest 或浏览器验收。以下操作需要操作者确认数据库目标与备份；AI 执行时另行取得对应授权。

## 配置

| 位置 | 配置 | 本地示例 |
| --- | --- | --- |
| Backend | `WEB_ORIGINS` | `["http://localhost:3000"]` |
| Backend | `ADMIN_ORIGINS` | `["http://localhost:3001"]` |
| Backend | `NAV_READER_TTL_SECONDS` | `604800`，固定七天 |
| Web | `WEB_PUBLIC_ORIGIN` | `http://localhost:3000` |
| Web | `ADMIN_PUBLIC_ORIGIN` | `http://localhost:3001` |
| Web | `BACKEND_INTERNAL_URL` | `http://localhost:8000` |

两个公开 Origin 必须准确、不同且无子路径。不要混用 `localhost` 与 `127.0.0.1`。生产使用 HTTPS，Backend 设置 `AUTH_COOKIE_SECURE=true`，Web 从公开 HTTPS Origin 设置 Secure Cookie。生产 Compose 从根环境模板读取 `ADMIN_PUBLIC_ORIGIN`；Admin 运行时从后端公开配置端点取得回调 allowlist，不需要把域名烘焙进镜像。

## 启用顺序

1. 确认备份可恢复，并核对目标数据库。
2. 在 `apps/backend` 运行 `uv run alembic upgrade head`，新增 `20260906_01` 和 `20260906_02`，不修改原身份表。
3. 按[环境与初始化手册](environment-variables-and-backend-local-run.md)先预览再应用源码权限目录；需要四项 `navigation:*` 权限。普通角色按需要授予，超级管理员按源码目录取得权限。
4. 启动 Backend、Admin、Web。Admin 日常命令为 `pnpm --filter @pinjie/admin dev`；Web 为 `pnpm --filter @pinjie/web dev`。
5. 管理端进入“导航管理”，依次创建分类、可选标签、站点、图标和帐号，再发布站点。
6. 访问 Web 首页，检查公开站点、搜索、分类和标签；管理员登录后检查帐号与密码原样显示。
7. 分别检查 Web 退出后保持公开状态、重新显式登录、Admin 普通退出后现有 Web 查阅继续有效、停用或改密后查阅失效。

## 运维与回滚

- 外层代理不得记录请求体、Cookie、响应体或浏览器 fragment。认证页面不要接入第三方统计。导航回调使用 fragment 传递一次性码，避免 Next 开发日志和代理 query 日志记录码。
- `scripts.cleanup_security_logs` 沿用受控 dry-run/`--apply`，现包含超出会话保留期的导航授权码与查阅会话。不要在请求链自动删除业务记录。
- 分类删除被回收站引用阻止时，先恢复站点并调整分类。站点恢复后需要重新发布。图标解除所有引用后才允许删除资产。
- 回滚优先退回应用并保留新增表及已写入数据。迁移 downgrade 会删除导航表，不能作为已有数据环境的默认恢复动作。
- 数据库备份包含明文外网凭据，禁止将备份或真实帐号加入 Git、日志、测试样例和公开目录。
