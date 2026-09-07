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
2. 在 `apps/backend` 运行 `uv run alembic upgrade head`，导航迁移依次为 `20260906_01`、`20260906_02`、`20260907_01` 和 `20260907_02`。`20260907_01` 给分类增加非空 `requires_login`，已有分类默认公开；`20260907_02` 增加可空 `icon_key` 和允许值检查约束，已有分类保持 null 并显示默认图标。在启用新后端前完成升级并核对字段，不修改原身份表。
3. 按[环境与初始化手册](environment-variables-and-backend-local-run.md)先预览再应用源码权限目录；当前有五项 `navigation:*` 权限。普通角色按需要授予，超级管理员按源码目录取得权限。新增的 `navigation:purge` 单独控制回收站永久删除及所属帐号资料删除，普通维护权限不自动获得此能力。
4. 启动 Backend、Admin、Web。Admin 日常命令为 `pnpm --filter @pinjie/admin dev`；Web 为 `pnpm --filter @pinjie/web dev`。
5. 管理端在“分类管理”（`/categories`）和“标签管理”（`/tags`）独立页面创建分类及可选标签，再进入“站点管理”（`/navigation`）创建站点、图标和帐号并发布。侧栏三个入口依次位于“欢迎”下方，站点管理页内保留“站点”和“回收站”视图。
6. 访问 Web 首页，检查公开站点、搜索、分类和标签；管理员登录后检查帐号与密码原样显示。
7. 分别检查 Web 退出后保持公开状态、重新显式登录、Admin 普通退出后现有 Web 查阅继续有效、停用或改密后查阅失效。
8. 对需要保护的分类打开“仅登录后可见”，分别核对访客、普通用户登录与管理员查阅登录；公开搜索、标签筛选、分类 ID 查询及分页总数不可包含受限站点，退出和其他标签页退出后不可残留受限内容。
9. 在分类表单按中文名称或英文标识搜索并选择图标，保存后检查 Admin 图标列和 Web 分类导航；重新编辑检查回显，清除并保存后检查默认图标。分类图标不上传文件，站点 LOGO 仍通过原上传入口维护。

## 永久删除启用与核验

1. 核对目标环境，在 `apps/backend` 使用 `uv run python -m scripts.sync_permissions --check --confirm-database <已核对的数据库名>` 预览权限目录差异，经授权后将 `--check` 改为 `--apply` 执行，按职责分配 `navigation:purge` 并刷新管理员权限。尖括号内容须替换为实际数据库名；只有 `--apply` 写权限表，本次实现未执行权限同步。
2. 永久删除复用 `20260906_02` 中站点帐号和标签关联的 ON DELETE CASCADE，无新增迁移；其他分类功能的迁移要求继续适用。
3. 在隔离验收环境准备可删除站点，先移入回收站，核对单条和批量永久删除确认、取消、成功刷新、无权限拒绝及混入正常站点时整批拒绝。数据库核验应确认站点、所属帐号及标签关联已删除，共享分类、标签、图标资产和审计保留。本次未执行此类真实数据验证。
4. 正式操作前确认所选范围和备份恢复能力。删除成功后不能从回收站恢复；请求超时或结果不明时先刷新列表核对，避免盲目重复提交。

## 运维与回滚

- 外层代理不得记录请求体、Cookie、响应体或浏览器 fragment。认证页面不要接入第三方统计。导航回调使用 fragment 传递一次性码，避免 Next 开发日志和代理 query 日志记录码。
- `scripts.cleanup_security_logs` 沿用受控 dry-run/`--apply`，现包含超出会话保留期的导航授权码与查阅会话。不要在请求链自动删除业务记录。
- 分类删除被回收站引用阻止时，先恢复站点并调整分类。站点恢复后需要重新发布。图标解除所有引用后才允许删除资产。
- 配置仅登录可见分类后禁止直接回退到没有分类过滤的旧应用，否则可能公开受限资料。故障时先关闭外部访问，保留字段和数据并前向修复，确认过滤恢复后再开放。`20260907_01` 明确拒绝 downgrade，历史导航迁移也不能作为已有数据环境的默认恢复动作。
- 数据库备份包含明文外网凭据，禁止将备份或真实帐号加入 Git、日志、测试样例和公开目录。
- `20260907_02` 拒绝通过 downgrade 丢弃图标配置；故障时保留字段和约束并前向修复。迁移未完成时新后端不具备分类查询条件，不得将类型和静态检查通过当作已启用证据。
