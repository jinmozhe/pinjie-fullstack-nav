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

- `GET /api/v1/navigation/sites` 支持分页和名称包含搜索，忽略大小写，去除首尾空白，按字面匹配搜索特殊字符；有搜索词时忽略分类和标签，无搜索词时支持分类、标签筛选。始终排除仅登录可见分类下的站点，过滤后计算分页和总数。筛选目标不存在、停用或不可见时返回 404。
- `GET /api/v1/navigation/groups` 与 `GET /api/v1/nav-reader/groups` 按分类排序分页读取非空分组，默认每页 6 组、最多 12 组。每组返回分类、真实可见站点总量和最多 8 个预览站点，顶层 total 为可见非空分类数。查阅入口要求有效管理员查阅会话。
- `GET /api/v1/navigation/sites/{site_id}` 与 `GET /api/v1/nav-reader/sites/{site_id}` 分别读取公开或管理员可见的单个站点资料，不含帐号；站点不存在或不可见时返回 404。
- `GET /api/v1/navigation/taxonomy/{kind}` 只返回启用的公开分类或启用标签，携带查阅 Cookie 也不扩展公开入口的可见范围。
- `GET /api/v1/nav-reader/sites` 与 `GET /api/v1/nav-reader/taxonomy/categories` 要求有效管理员查阅会话，包含仅登录可见分类；仍排除停用分类、未发布及已删除站点。查阅列表沿用公开列表的名称搜索和筛选错误语义；Admin 管理列表继续支持名称或简介搜索。
- `GET /api/v1/navigation/sites/{site_id}/accounts` 要求独立查阅身份，并只返回启用帐号。
- `/api/v1/admin/navigation/` 提供分类、标签、站点、帐号的管理接口；写操作要求管理员会话、资源权限、CSRF 和审计。
- `/bulk` 接受 1 至 100 个唯一 ID，固定顺序锁定，单事务全有或全无。

Web 只显示已发布、未删除且分类启用的站点。分组和完整列表共用可见条件，分类及站点均按 `sort_order`、ID 稳定排序；数据库窗口查询先计算分类总量与站点序号，再截取每组预览，不逐分类发起无界请求。站点下架、分类停用或站点删除使凭据查阅接口同时不可见；Admin 仍可读取已保留资料。恢复站点后保持未发布。图标使用 `navigation_icon` 上传场景，限制 2 MB 的 PNG/JPEG/WebP，仍被任何站点引用时不能删除资产。

Admin 侧栏按“欢迎、站点管理、分类管理、标签管理”的顺序排列为同级菜单。`/navigation` 保留站点和回收站两个视图，`/categories` 与 `/tags` 分别提供独立的分类和标签页面，避免路径前缀导致站点管理同时选中；三个页面沿用 `canNavigation` 访问控制及现有读写权限。帐号在站点抽屉管理，站点移入回收站以及分类、标签、帐号硬删除的单条与批量操作均复用标准确认弹窗；启停、发布、下架和恢复直接提交。站点列顺序为 LOGO、站点、分类、网址、标签、排序、状态、操作，网址与标签保持弹性列宽并单行省略。Web `/` 为公开导航；原首页通用能力保留在 `/system-status`，用户中心入口仍可访问。

分类新增和编辑支持“仅登录后可见”开关，列表展示公开或登录可见，沿用 `navigation:write` 权限与审计。分类专属 Schema 扩展公共字段，标签不保存且拒绝显式提交 `requires_login`。普通用户登录不参与分类授权，站点继承所属分类可见性，凭据继续使用原查阅权限。

分类与标签共用的 taxonomy 接口采用命名联合类型。契约保留各分支校验，同时从原基础 Schema 生成公共 object、字段和 required 约束，使调用方可以直接识别名称、ID 等公共字段；禁止仅为通过检查隐藏分支或放宽运行时校验。

## 管理端站点信息抓取

`POST /api/v1/admin/navigation/metadata` 要求 Admin 会话、`navigation:write` 和 CSRF，输入完整 HTTP(S) 网址，返回 `NavMetadataRead` 草稿，不保存站点或资产。名称依次使用 `og:site_name`、`og:title`、title；描述优先 description，再使用 `og:description`。缺失字段为 null，warnings 明确未完成项目；整页无法获取使用 502、超时 504、不安全地址 422、并发满 429。

Admin 新增与编辑表单均将网址置前，点击“抓取”填入名称、简介和图标，缺失项保留原值；请求期间手动修改的字段不覆盖。修改网址、关闭表单或切换站点会取消抓取并丢弃迟到结果。抓取与图片上传互斥，进行时不允许保存。图标只在草稿内存中预览，点击保存后通过现有 `navigation_icon` 上传 API 保存，再关联站点；站点保存失败保留已上传资产 ID，重试不重复上传。分类、标签、排序、发布和帐号均不由抓取结果改变。

公网读取适配器 `app/core/public_http.py` 由 AppResources 创建并关闭共享 httpx 客户端。只接受 HTTP 80 与 HTTPS 443，拒绝 URL 登录信息、私网、回环、链路本地、保留与 IPv6 过渡地址。每次连接前验证全部 DNS 地址，连接固定到已校验 IP，同时保留原 Host 与 TLS 域名验证；重定向逐跳重新验证。客户端禁用环境代理、远端 Cookie 保存及传递、自动重试和连接复用，不读取认证页面或执行 JavaScript。

抓取并发最多 4 个，满载立即返回带 Retry-After 的 429，无等待队列；完整网络抓取预算 20 秒，每个图标候选最多 3 秒，各次请求最多 3 次重定向。HTML 上限 1 MiB，图标上限 2 MiB，响应 MIME 和声明、实际字节数同时校验；请求 identity 编码并拒绝压缩响应。最多读取页面前两个图标候选和根 favicon.ico。图片转换在线程池执行，取消时等待在途转换释放资源，不启动无限图片任务。

图标支持 PNG、JPEG、WebP、GIF 首帧和 ICO，拒绝 SVG；位图不超过 400 万像素，输出最大 256 × 256 PNG。ICO 在 Pillow 打开前校验帧目录和内嵌尺寸，最多 64 帧。返回 Base64 上限 400000 字符，不返回第三方图标热链；目标无图标、反爬、仅脚本生成、压缩响应或不支持格式均可导致部分获取，前端明确提示并保留手动上传。

运行日志仅记录错误分类或缺失数量，不保存完整目标 URL、第三方响应和图片。标准 HTTP 库关闭 INFO/DEBUG 请求日志，导航敏感路由继续禁止请求体持久化。解析与元数据适配器位于 navigation 领域，Application Service 通过 MetadataSource Port 调用并映射错误。实际安全测试与 UI 验收状态见[站点信息抓取计划](../../plans/2026-09-07_站点信息抓取计划.md)。固定 IP 与 TLS 主机名的实现依据为 [HTTPCore SNI 扩展](https://www.encode.io/httpcore/extensions/#sni_hostname)，运行锁定版本源码同时核对该扩展。

## Web 页面与详情

Web 首页由服务端读取身份、分类、标签和首批分组；分类、标签及搜索结果按每页 24 个读取。`search`、`category`、`tag`、`page` 查询参数保存状态，搜索与分类标签互斥。原生链接保留新标签页打开能力，当前页切换同步浏览器历史，前进后退恢复列表并关闭详情。可见空分类保留在侧栏，首页跳过空分组；失效筛选显示错误与返回全部入口。

导航 Feature 使用独立 tokens、共用卡片、侧栏抽屉和原生 dialog，视觉与响应式标准见 [Web 导航端设计标准](web-design-standard.md)。卡片主体打开详情，仅右上外链独立打开目标站点。详情按需获取当前站点资料，分类与标签进入各自列表第一页；手机分类独占一行，全部标签另起一行靠左。侧栏底部只显示配置品牌与当年版权，原用户中心和系统状态路由保留。

有效管理员打开详情后按需读取帐号，全部展开并分别复制非空用户名、密码和备注。访客、普通用户、无权限或成功零帐号时隐藏整个帐号区；有权请求失败显示重试。加载、刷新和身份重新核验期间隐藏旧帐号，关闭、导航、后台切换与退出取消在途请求并清理内存缓存。原生弹窗提供焦点约束、Escape 和遮罩关闭，关闭时恢复触发控件或列表标题焦点。

## 回收站永久删除

`POST /api/v1/admin/navigation/sites/purge` 使用专用 `NavSitePurgeIn` 接收 1 至 100 个唯一站点 UUID，单条与批量共用，返回实际 `completed_count`。原 `/sites/bulk` 的 delete 仍为软删除。新端点要求 Admin 会话、CSRF 和 `navigation:purge`，事务内重新核验管理员启用状态与当前权限。

Service 按 ID 顺序锁定站点并刷新状态，先验证所有目标均存在且位于回收站，再由 Repository 执行 DELETE RETURNING。目标缺失返回 404，目标已恢复或状态冲突返回 409，整批不生效。恢复、帐号维护与永久删除通过站点行锁协调。现有外键级联删除 `nav_site_accounts` 和 `nav_site_tags`；分类、标签、图标资产行和文件保留，无新增迁移。

审计动作是 `navigation.sites.purge`，仅保存目标 ID 与结果，不保存帐号字段。成功审计与删除共用业务事务，审计失败拒绝或回滚删除；历史审计继续保留。永久删除提交后无法在回收站恢复，代码回退也不恢复数据。

Admin 回收站提供单条红色删除图标和批量“永久删除”，恢复仍使用 `navigation:write`。操作复用标准确认弹窗，捕获操作类型与 ID 快照，说明不可恢复及关联范围，提交中阻止重复提交，失败保留目标与错误。删除请求不自动重试。成功后刷新列表、清空选择并修正空页，关闭相关帐号抽屉、取消在途帐号查询并清除缓存。响应丢失时先刷新核对结果。

## 分类图标

分类使用内置图标，`icon_key` 保存稳定语义标识，与站点上传的 `icon_asset_id` 独立。分类创建和更新支持选择或清除，省略或传入 null 表示默认文件夹图标；分类列表、公开分类、管理员查阅分类及站点内嵌分类均返回该字段。标签拒绝显式提交 `icon_key`，包括 null。

允许值由 Backend 分类 Schema 定义，并通过唯一 OpenAPI 生成客户端类型；数据库 `ck_nav_categories_icon_key` 同时约束持久化允许值。新增图标时在同一变更内同步 Schema、新增约束迁移和两端映射。当前允许值为 `code`、`book`、`tool`、`app`、`globe`、`cloud`、`database`、`api`、`design`、`image`、`video`、`music`、`ai`、`chart`、`education`、`news`、`community`、`shopping`、`game`、`security`。

Admin 使用现有 Ant Design Select 按中文标签或英文标识搜索，选项和选中值展示图标，分类列表设固定宽度图标列；清除仅改变表单草稿，保存后才持久化，失败保留草稿。图标采用静态导入的 `@ant-design/icons`，Web 分类导航按相同标识映射 Lucide，两端外观遵循各自设计体系，映射完整性由生成字段类型约束。Web 图标为装饰内容，分类链接保留名称、键盘操作和明确的目标列表。

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
- 分类、分组、站点列表和详情使用独立的公开与管理员标识查询缓存，查阅数据只存内存。身份重新核验、退出请求期间隐藏授权内容；退出、身份失效、后台切换取消请求并清除查阅缓存，禁止旧响应恢复内容。身份失效时回到全部站点第一页；身份有效但当前筛选不再可见时显示错误。分类、分组、站点和详情每 30 秒刷新，后台配置在后续请求生效，不承诺实时推送。
- 导航响应和认证回调使用 `no-store`，回调使用 `no-referrer`。导航错误日志不保存请求体或异常正文，SQLAlchemy 隐藏查询参数。审计只记录动作与目标 ID，不记录帐号字段值。
- 已被人看到或复制到系统剪贴板的明文无法通过退出收回；源码、数据库备份和运行权限必须按实际部署边界管理。

## 验证与启用

实现包含真实 PostgreSQL 生命周期、授权码重放、权限拒绝、两端独立退出以及 Web BFF、回调和抑制测试代码。导航视觉改版补充了分组边界、名称搜索、详情可见性、URL 状态、卡片交互与帐号清理的回归测试源码。测试存在不代表已执行；结果分别见[基础导航实施计划](../../plans/2026-09-06_导航管理与管理员只读查阅计划.md)和[Web 设计实施计划](../../plans/2026-09-07_Web导航视觉与详情设计计划.md)。启用与迁移步骤见[导航启用手册](../operations/navigation-setup.md)。
