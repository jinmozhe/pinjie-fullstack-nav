# 导航管理与管理员查阅

## 范围与数据

产品边界见 [产品需求基线](../PROJECT_REQUIREMENTS.md)，认证取舍见 [ADR 0016](../adr/0016-管理员身份与导航只读会话决策.md)。导航资料为统一收藏，不关联普通用户。原普通用户、注册设置、Admin 认证和管理能力保留。

| 表 | 职责与约束 |
| --- | --- |
| `nav_categories` | 一级分类，名称唯一，说明、排序、启停；存在任意站点引用时拒绝删除 |
| `nav_tags` | 名称唯一，说明、排序、启停；删除仅解除站点关联 |
| `nav_sites` | 必选单分类、多标签、名称、HTTP(S) 网址、简介、图标资产、排序和发布；继承软删除主体字段 |
| `nav_site_tags` | 站点标签联合主键，禁止重复关联 |
| `nav_site_accounts` | 站点外键、名称、用户名、明文密码、备注、排序、启停；用户名、密码、备注至少一项非空 |
| `nav_authorization_codes` | 授权码 HMAC、管理员、凭据版本、state、S256、精确回调、60 秒期限与消费时间 |
| `nav_reader_sessions` | 会话 HMAC、CSRF HMAC、管理员、凭据版本、固定期限和撤销时间；不引用 Admin Session |

密码不 trim，不套用系统登录密码策略。密码和备注最多 10000 字符，用户名最多 500 字符。系统登录密码继续使用 Argon2id。

## 接口与维护

唯一机器契约为根 [openapi.json](../../openapi.json)。`navigation:read`、`navigation:write` 分别管理导航读写，`navigation:credentials:read`、`navigation:credentials:write` 分别管理外网凭据读写。

- `GET /api/v1/navigation/sites` 支持分页、名称或简介搜索、分类和标签筛选。
- `GET /api/v1/navigation/taxonomy/{kind}` 只返回启用分类或标签。
- `GET /api/v1/navigation/sites/{site_id}/accounts` 要求独立查阅身份，并只返回启用帐号。
- `/api/v1/admin/navigation/` 提供分类、标签、站点、帐号的管理接口；写操作要求管理员会话、资源权限、CSRF 和审计。
- `/bulk` 接受 1 至 100 个唯一 ID，固定顺序锁定，单事务全有或全无。

Web 只显示已发布、未删除且分类启用的站点。站点下架、分类停用或站点删除使凭据查阅接口同时不可见；Admin 仍可读取已保留资料。恢复站点后保持未发布。图标使用 `navigation_icon` 上传场景，限制 2 MB 的 PNG/JPEG/WebP，仍被任何站点引用时不能删除资产。

Admin `/navigation` 提供站点、分类、标签、回收站四个视图。帐号在站点抽屉管理，硬删除复用标准确认弹窗，软删除和启停直接提交。Web `/` 为公开导航；原首页通用能力保留在 `/system-status`，用户中心入口仍可访问。

## 跨端登录

1. Web `/api/navigation/start` 在 HttpOnly Cookie 中保存五分钟的随机 state/verifier，将 S256 challenge 和精确回调地址带到 Admin `/navigation/authorize`。
2. Admin 复用现有登录或 Refresh。显式登录缺少会话时进入原登录页，并在成功后返回授权页。自动探测缺少身份或权限时返回 Web，不强制访客登录。
3. 管理员通过 `/api/v1/admin/nav-reader/authorize` 获得 60 秒一次性授权码。码只通过 Web `/navigation/callback` 的 URL fragment 返回，fragment 不发送给服务器访问日志；页面立即清除 fragment，用 POST 发送到同源 `/api/navigation/callback`。
4. Web 服务端验证 Origin、state、Cookie 期限，并携带隐藏 verifier 调用 Backend `/api/v1/nav-reader/exchange`。后端精确校验回调、S256、管理员版本和权限，行锁单次消费，签发独立查阅 Cookie。
5. 会话原值仅进入 `pinjie_reader_session` HttpOnly Cookie；数据库只保存带 `nav-reader:` 用途前缀的 HMAC。`pinjie_reader_csrf` 为可读 CSRF Cookie。默认固定七天有效，通过 `NAV_READER_TTL_SECONDS` 配置，无滑动 Refresh。

每次查阅重新核验管理员启用状态、凭据版本、当前角色与查看权限。查阅 Cookie 不能充当 Admin 或普通用户 Cookie，Web BFF 对导航路径只透传 reader Cookie，对原用户路径只透传 web Cookie；没有开放 Admin 写代理。

## 退出与敏感数据

- Web 退出只撤销当前 reader Session，清除其 Cookie 并写入一年有效的 HttpOnly 自动登录抑制标记；主动登录成功后解除。
- Admin Logout 沿用原行为，不修改 reader Session。管理员停用、凭据版本或当前权限变化仍影响下一次查阅资格。
- 自动探测每次页面挂载最多一次，同一浏览器另有 60 秒尝试标记，返回结果页面不重复探测。
- Web 关闭详情、切换到后台、会话失效或退出时隐藏帐号并移除查询缓存；同源标签通过 BroadcastChannel 同步 Web 退出。会话和打开的凭据每 30 秒重新核验，重新核验期间隐藏旧凭据。
- 导航响应和认证回调使用 `no-store`，回调使用 `no-referrer`。导航错误日志不保存请求体或异常正文，SQLAlchemy 隐藏查询参数。审计只记录动作与目标 ID，不记录帐号字段值。
- 已被人看到或复制到系统剪贴板的明文无法通过退出收回；源码、数据库备份和运行权限必须按实际部署边界管理。

## 验证与启用

实现包含真实 PostgreSQL 生命周期、授权码重放、权限拒绝、两端独立退出以及 Web BFF、回调和抑制测试代码。测试存在不代表已执行；本次实际结果以[实施计划](../../plans/2026-09-06_导航管理与管理员只读查阅计划.md)为准。启用与迁移步骤见[导航启用手册](../operations/navigation-setup.md)。
