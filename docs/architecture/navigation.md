# 导航管理与管理员查阅

## 范围与数据

产品边界见 [产品需求基线](../PROJECT_REQUIREMENTS.md)，认证取舍见 [ADR 0016](../adr/0016-管理员身份与导航只读会话决策.md)。导航资料为统一收藏，不关联普通用户。原普通用户、注册设置、Admin 认证和管理能力保留。

| 表 | 职责与约束 |
| --- | --- |
| `nav_categories` | 一级分类，名称唯一，说明、排序、启停、`requires_login`（默认 false）、可空 `icon_key`；存在任意站点引用时拒绝删除 |
| `nav_tags` | 名称唯一，说明、排序、启停；删除仅解除站点关联 |
| `nav_sites` | 必选单分类、多标签、名称、HTTP(S) 网址、简介、图标资产、排序和发布；继承软删除主体字段 |
| `nav_site_tags` | 站点标签联合主键，禁止重复关联 |
| `nav_site_accounts` | 站点外键、名称、用户名、明文密码、备注、排序、启停；用户名、密码、备注至少一项非空 |
| `nav_authorization_codes` | 授权码 HMAC、管理员、凭据版本、state、S256、精确回调、60 秒期限与消费时间 |
| `nav_reader_sessions` | 会话 HMAC、CSRF HMAC、管理员、凭据版本、固定期限和撤销时间；不引用 Admin Session |

密码不 trim，不套用系统登录密码策略。密码和备注最多 10000 字符，用户名最多 500 字符。系统登录密码继续使用 Argon2id。

## 接口与维护

唯一机器契约为根 [openapi.json](../../openapi.json)。`navigation:read`、`navigation:write` 分别管理导航读写，`navigation:credentials:read`、`navigation:credentials:write` 分别管理外网凭据读写。独立的 `navigation:purge` 允许永久删除回收站站点及其所属帐号资料，不由维护权限隐式授予。

- `GET /api/v1/navigation/sites` 支持分页、名称或简介搜索、分类和标签筛选，始终排除仅登录可见分类下的站点，过滤后计算分页和总数。
- `GET /api/v1/navigation/taxonomy/{kind}` 只返回启用的公开分类或启用标签，携带查阅 Cookie 也不扩展公开入口的可见范围。
- `GET /api/v1/nav-reader/sites` 与 `GET /api/v1/nav-reader/taxonomy/categories` 要求有效管理员查阅会话，包含仅登录可见分类；仍排除停用分类、未发布及已删除站点。
- `GET /api/v1/navigation/sites/{site_id}/accounts` 要求独立查阅身份，并只返回启用帐号。
- `/api/v1/admin/navigation/` 提供分类、标签、站点、帐号的管理接口；写操作要求管理员会话、资源权限、CSRF 和审计。
- `/bulk` 接受 1 至 100 个唯一 ID，固定顺序锁定，单事务全有或全无。

Web 只显示已发布、未删除且分类启用的站点。站点下架、分类停用或站点删除使凭据查阅接口同时不可见；Admin 仍可读取已保留资料。恢复站点后保持未发布。图标使用 `navigation_icon` 上传场景，限制 2 MB 的 PNG/JPEG/WebP，仍被任何站点引用时不能删除资产。

Admin 侧栏按“欢迎、站点管理、分类管理、标签管理”的顺序排列为同级菜单。`/navigation` 保留站点和回收站两个视图，`/categories` 与 `/tags` 分别提供独立的分类和标签页面，避免路径前缀导致站点管理同时选中；三个页面沿用 `canNavigation` 访问控制及现有读写权限。帐号在站点抽屉管理，站点移入回收站以及分类、标签、帐号硬删除的单条与批量操作均复用标准确认弹窗；启停、发布、下架和恢复直接提交。站点列顺序为 LOGO、站点、分类、网址、标签、排序、状态、操作，网址与标签保持弹性列宽并单行省略。Web `/` 为公开导航；原首页通用能力保留在 `/system-status`，用户中心入口仍可访问。

分类新增和编辑支持“仅登录后可见”开关，列表展示公开或登录可见，沿用 `navigation:write` 权限与审计。分类专属 Schema 扩展公共字段，标签不保存且拒绝显式提交 `requires_login`。普通用户登录不参与分类授权，站点继承所属分类可见性，凭据继续使用原查阅权限。

## 回收站永久删除

`POST /api/v1/admin/navigation/sites/purge` 使用专用 `NavSitePurgeIn` 接收 1 至 100 个唯一站点 UUID，单条与批量共用，返回实际 `completed_count`。原 `/sites/bulk` 的 delete 仍为软删除。新端点要求 Admin 会话、CSRF 和 `navigation:purge`，事务内重新核验管理员启用状态与当前权限。

Service 按 ID 顺序锁定站点并刷新状态，先验证所有目标均存在且位于回收站，再由 Repository 执行 DELETE RETURNING。目标缺失返回 404，目标已恢复或状态冲突返回 409，整批不生效。恢复、帐号维护与永久删除通过站点行锁协调。现有外键级联删除 `nav_site_accounts` 和 `nav_site_tags`；分类、标签、图标资产行和文件保留，无新增迁移。

审计动作是 `navigation.sites.purge`，仅保存目标 ID 与结果，不保存帐号字段。成功审计与删除共用业务事务，审计失败拒绝或回滚删除；历史审计继续保留。永久删除提交后无法在回收站恢复，代码回退也不恢复数据。

Admin 回收站提供单条红色删除图标和批量“永久删除”，恢复仍使用 `navigation:write`。操作复用标准确认弹窗，捕获操作类型与 ID 快照，说明不可恢复及关联范围，提交中阻止重复提交，失败保留目标与错误。删除请求不自动重试。成功后刷新列表、清空选择并修正空页，关闭相关帐号抽屉、取消在途帐号查询并清除缓存。响应丢失时先刷新核对结果。

## 分类图标

分类使用内置图标，`icon_key` 保存稳定语义标识，与站点上传的 `icon_asset_id` 独立。分类创建和更新支持选择或清除，省略或传入 null 表示默认文件夹图标；分类列表、公开分类、管理员查阅分类及站点内嵌分类均返回该字段。标签拒绝显式提交 `icon_key`，包括 null。

允许值由 Backend 分类 Schema 定义，并通过唯一 OpenAPI 生成客户端类型；数据库 `ck_nav_categories_icon_key` 同时约束持久化允许值。新增图标时在同一变更内同步 Schema、新增约束迁移和两端映射。当前允许值为 `code`、`book`、`tool`、`app`、`globe`、`cloud`、`database`、`api`、`design`、`image`、`video`、`music`、`ai`、`chart`、`education`、`news`、`community`、`shopping`、`game`、`security`。

Admin 使用现有 Ant Design Select 按中文标签或英文标识搜索，选项和选中值展示图标，分类列表设固定宽度图标列；清除仅改变表单草稿，保存后才持久化，失败保留草稿。图标采用静态导入的 `@ant-design/icons`，Web 分类导航按相同标识映射 Lucide，两端外观遵循各自设计体系，映射完整性由生成字段类型约束。Web 图标为装饰内容，保留分类按钮名称、键盘操作和既有筛选语义。

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
- Web SSR 只读取并透传 reader Session Cookie，校验成功后请求查阅分类和站点。缺少会话或明确 401 使用公开入口；403、网络及服务故障展示加载失败，不把故障当作认证成功。
- 分类和站点使用独立的公开与管理员标识查询缓存，查阅数据只存内存。身份重新核验、退出请求期间隐藏授权内容；退出、身份失效、后台切换取消请求并清除查阅缓存，禁止旧响应恢复内容。身份失效或当前分类不再可见时回到全部站点第一页。分类与站点每 30 秒刷新，后台配置在后续请求生效，不承诺实时推送。
- 导航响应和认证回调使用 `no-store`，回调使用 `no-referrer`。导航错误日志不保存请求体或异常正文，SQLAlchemy 隐藏查询参数。审计只记录动作与目标 ID，不记录帐号字段值。
- 已被人看到或复制到系统剪贴板的明文无法通过退出收回；源码、数据库备份和运行权限必须按实际部署边界管理。

## 验证与启用

实现包含真实 PostgreSQL 生命周期、授权码重放、权限拒绝、两端独立退出以及 Web BFF、回调和抑制测试代码。测试存在不代表已执行；本次实际结果以[实施计划](../../plans/2026-09-06_导航管理与管理员只读查阅计划.md)为准。启用与迁移步骤见[导航启用手册](../operations/navigation-setup.md)。
