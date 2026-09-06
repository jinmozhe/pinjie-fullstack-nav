# 容器构建与运行手册

## 1. 适用范围

本文说明三个应用镜像的本地构建检查、阶段 C 初始化工具和生产 Compose 接线。操作人员执行现行 GitHub、CNB、TCR、1Panel 发布链路时，从[GitHub 到 1Panel 端到端人工发布手册](github-cnb-tcr-1panel-release-runbook.md)开始；真实镜像发布、生产部署和回滚仍需分别授权。

## 2. 构建前提

Admin/Web Dockerfile 的依赖层只复制根清单、锁文件、pnpm 配置与钩子、三个共享包的 package.json 和补丁；完整共享包源码在依赖安装后复制。新增工作区包或安装期钩子时必须复核这一输入边界，禁止漏掉安装必需文件。Registry 缓存与 Git committer time 策略保持现状，缓存收益以实际新 Run 计时为准。

已授权源码 E2E 需要 Docker：`pnpm test:e2e` 使用 Web standalone 和固定 Nginx 镜像托管 Admin dist，不再启动 Admin dev。当前生产镜像由人工核对 CNB/TCR 证据后通过 1Panel 部署，操作见[端到端人工发布手册](github-cnb-tcr-1panel-release-runbook.md)，不要求额外运行候选镜像验收。

- 构建主机使用 Linux x86_64 或 Docker Desktop Linux 容器模式。
- Backend 使用标准 CPython 3.14，当前构建与运行阶段固定官方 `python:3.14.7-slim-trixie@sha256:ce40764625a4ff50df3548277632e7f96c4e77fe75fa848aae9885476e7df5a4`，工具来源固定 `uv:0.11.32@sha256:df4cae8f3a96d175e2e5f992e597550000edbe78fdc2594d5cd8de1a217f504c`，镜像内只安装 `uv.lock` 的运行依赖。
- Web 与 Admin 构建阶段及 Web 运行阶段固定 `node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43`，Admin 运行阶段固定 `nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de`，并在构建时升级当前 Alpine 仓库能够修复的全部已安装包。
- 根目录是三个 Dockerfile 的构建上下文，不能把应用子目录单独作为上下文。
- 生产 PostgreSQL 18.4 与 Redis 8.10.0 由 1Panel 作为服务器级共享服务管理，不进入应用镜像构建或项目 Compose。

## 3. 本地构建

从仓库根目录执行：

```powershell
docker build -f apps/backend/Dockerfile -t pinjie-fullstack-backend:local .
docker build -f apps/web/Dockerfile -t pinjie-fullstack-web:local .
docker build -f apps/admin/Dockerfile -t pinjie-fullstack-admin:local .
```

构建完成后检查镜像用户和架构：

```powershell
docker image inspect pinjie-fullstack-backend:local --format '{{.Architecture}} {{.Config.User}}'
docker image inspect pinjie-fullstack-web:local --format '{{.Architecture}} {{.Config.User}}'
docker image inspect pinjie-fullstack-admin:local --format '{{.Architecture}} {{.Config.User}}'
```

Backend、Web 和 Admin 应分别以非 root 用户运行。具体 UID 属于镜像实现细节，检查结果必须确认不是空值或 `0`。

阶段 B 收尾已在 Linux x86_64 容器模式成功构建并运行三张镜像。Backend、Web 和 Admin 分别以 `app`、`app` 和 `nginx` 非 Root 用户运行，内置健康检查均达到 `healthy`；该结果不代替发布时的 SBOM、来源证明、目标镜像扫描和生产部署验证。

## 4. CNB 构建与 TCR 发布

正式镜像由 CNB 根目录 `.cnb.yml` 构建，GitHub Runner 只负责把通过门禁的固定 Commit SHA 交接到 CNB `main`。CNB 使用 4 核 Linux AMD64 社区节点和固定 digest 的构建、Trivy、附件插件镜像，三个应用继续共用仓库根构建上下文。

CNB 密钥仓库文件地址固定为：

```text
https://cnb.cool/pjwl/pinjie-fullstack-base-secrets/-/blob/main/tcr-publish.yml
```

该文件由用户在 CNB Web 界面创建，不进入代码仓库，结构如下：

```yaml
TCR_REGISTRY: "ccr.ccs.tencentyun.com"
TCR_NAMESPACE: "pinjie-fullstack-base"
TCR_PUBLISH_USERNAME: "<TCR 发布用户名>"
TCR_PUBLISH_PASSWORD: "<TCR 固定密码>"

allow_slugs:
  - "pjwl/pinjie-fullstack-base"
allow_events:
  - "push"
  - "web_trigger_full_release"
allow_branches:
  - "main"
```

`.cnb.yml` 为 Backend、Web 和 Admin 声明三条按路径触发的独立 Pipeline。每张镜像按以下顺序处理：CNB 默认 Buildx `docker` 驱动从该应用的 TCR `buildcache-main` 读取缓存，从 Git Commit 计算 `SOURCE_DATE_EPOCH` 并写入 OCI `revision`、`created` 与 `source` 标签，生成最大级别 provenance 和 SBOM attestation，以 `candidate-<CNB Build ID>` 唯一候选标签推送内容，从 metadata 读取 digest 并核对候选标签和 attestation manifest，再由固定 digest 的 Trivy 对精确候选 digest 执行 High 与 Critical 阻断并生成 CycloneDX JSON SBOM。该端通过后创建 `sha-<完整 Commit SHA>` 标签，并保存 `pinjie-cnb-tcr-image-v1` 单镜像清单和原始证据附件。扫描失败时，CNB 日志会输出镜像引用、包名、CVE、已安装版本和修复版本，并将当前原始 JSON、digest、metadata 与精简摘要打包为失败附件；失败候选仍禁止部署。

路径无法可靠判断、首次运行或一次变更超过 CNB 的 300 文件统计上限时，在 `main` 分支详情页使用 `.cnb/web_trigger.yml` 提供的“三端全量镜像构建”按钮。该人工入口复用三个固定应用 Pipeline。CNB 密钥仓库的 `allow_events` 必须同时允许 `push` 和准确事件名 `web_trigger_full_release`，否则人工全量构建会在导入 TCR 凭据时失败。

`buildcache-main` 是可变构建缓存，`candidate-<CNB Build ID>` 是单次运行候选，两者都不能作为部署来源。生产只使用发布清单中的完整 `ccr.ccs.tencentyun.com/pinjie-fullstack-base/<镜像>@sha256:<digest>` 引用。

CNB 发布身份和生产服务器拉取身份必须分离。`tcr-publisher` 只保存在 CNB 密钥仓库；生产服务器使用只允许拉取指定三个仓库的 `tcr-puller`。完整 CAM JSON、账号创建、凭证初始化、服务器登录和轮换步骤见[腾讯云 CAM 子账号与 TCR 个人版最小权限操作手册](tencent-tcr-personal-cam-accounts.md)。

## 5. 生产 Compose 配置

生产目录至少需要：

```text
<DEPLOY_PATH>/
├── compose.prod.yml
├── .env
└── apps/backend/.env
```

根 `.env` 只写三个 TCR 完整镜像 digest 和 Web 公开 Origin：

```dotenv
BACKEND_IMAGE=ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-backend@sha256:<64位十六进制摘要>
WEB_IMAGE=ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-web@sha256:<64位十六进制摘要>
ADMIN_IMAGE=ccr.ccs.tencentyun.com/pinjie-fullstack-base/pinjie-fullstack-admin@sha256:<64位十六进制摘要>
WEB_PUBLIC_ORIGIN=https://www.example.com
```

`apps/backend/.env` 至少配置：

```dotenv
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://pinjie_fullstack_app:<URL编码后的生产密钥>@postgresql:5432/pinjie_fullstack_prod
REDIS_MODE=required
REDIS_URL=redis://default:<URL编码后的生产密钥>@redis:6379/1
RELEASE_VERSION=<完整Commit SHA或发布版本>
TRUSTED_HOSTS=["api.example.com","admin.example.com","www.example.com"]
WEB_ORIGINS=["https://www.example.com"]
ADMIN_ORIGINS=["https://admin.example.com"]
SESSION_RETENTION_DAYS=30
WEB_JWT_SECRET=<至少32字节的独立密钥>
ADMIN_JWT_SECRET=<至少32字节的独立密钥>
WEB_TOKEN_HMAC_KEY=<至少32字节的独立密钥>
ADMIN_TOKEN_HMAC_KEY=<至少32字节的独立密钥>
AUTH_COOKIE_SECURE=true
REQUEST_LOG_MODE=disabled
LOG_FILE_ENABLED=false
UPLOAD_STORAGE_DRIVER=local
UPLOAD_BASE_URL=/static/uploads
UPLOAD_MAX_FILE_SIZE_MB=50
UPLOAD_ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,gif,pdf,doc,docx,xls,xlsx,zip
UPLOAD_IO_CONCURRENCY=4
SETTINGS_MEDIA_ROOT=/app/storage/settings-media
SETTINGS_MEDIA_BASE_URL=/static/settings
```

真实密码、域名和应用镜像 digest 不得写入仓库。生产配置正反例门禁检查所有 Dockerfile `FROM`、应用镜像变量、外部 `1panel-network`、服务网络隔离和日志策略。生产 Compose 会对 Backend 和请求日志消费者强制覆盖 `LOG_FILE_ENABLED=false`，默认只写标准错误流。需要文件日志时必须同时提供明确的可写持久挂载、非 Root 权限、轮转和容量告警。1Panel OpenResty 负责公网 TLS 和域名转发。

当前人工生产部署使用 CNB 发布清单中的 TCR 完整 digest。GitHub `Deploy Production` 工作流仍校验并部署 GHCR，必须保持 `PRODUCTION_DEPLOYMENT_ENABLED=false`；将该工作流改造为 TCR 端到端自动部署需要独立计划和授权。

PostgreSQL 与 Redis 由 1Panel 作为服务器级共享服务管理，不属于项目 Compose。Backend 和请求日志消费者同时加入项目默认网络与外部 `1panel-network`，通过 `postgresql:5432` 和 `redis:6379` 连接；Web 与 Admin 只在项目默认网络，不能直接访问数据服务。每个项目必须使用独立 PostgreSQL 数据库与角色。当前生产 Redis 使用 `default` 用户和已分配的独立逻辑库 `/1`；该编号只隔离正常业务 Key，不构成权限边界。更高隔离要求使用独立 ACL 用户或独立 Redis 实例。

Backend 的 `backend_uploads` 命名卷挂载到 `/app/storage`，Compose 固定 `UPLOAD_LOCAL_ROOT=/app/storage/uploads` 与 `SETTINGS_MEDIA_ROOT=/app/storage/settings-media`。镜像内的 UID `10001` 必须能写入该卷；统一资产与配置媒体使用独立目录和私有补偿区，静态路由只暴露各自公开根。生产备份必须同时覆盖 PostgreSQL 和完整 `backend_uploads` 卷，并记录同一备份窗口。

系统设置迁移会以关闭状态创建公开注册配置。部署完成后由具备权限的管理员在 `/settings` 明确开启；生产环境不通过环境变量自动继承旧状态。配置媒体本地驱动只适用于单实例，或所有 Backend 实例共享同一可靠文件系统并具备写入协调的部署。

## 6. 迁移、权限与初始管理员

应用启动不自动修改数据库。首次部署或包含迁移的版本先执行：

```powershell
docker compose --env-file .env -f compose.prod.yml run --rm backend alembic upgrade head
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.sync_permissions --apply --confirm-database pinjie_fullstack_prod
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.sync_permissions --check --confirm-database pinjie_fullstack_prod
```

首次创建超级管理员时单独执行交互命令：

```powershell
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.create_initial_admin --username initial-admin --confirm-database pinjie_fullstack_prod
```

命令中的数据库名必须与 `DATABASE_URL` 完全一致。脚本不提供默认密码；已有账号默认拒绝，重置还需显式提供 `--reset-existing --confirm-reset`，并会撤销既有会话。

## 7. 启动与验证

```powershell
docker compose --env-file .env -f compose.prod.yml config --quiet
docker compose --env-file .env -f compose.prod.yml pull
docker compose --env-file .env -f compose.prod.yml up -d --wait
docker compose --env-file .env -f compose.prod.yml ps
```

当 `REQUEST_LOG_MODE=metadata` 时使用 Profile 启动独立消费者：

```powershell
docker compose --env-file .env -f compose.prod.yml --profile request-logs up -d --wait
```

保持 `REQUEST_LOG_MODE=disabled` 时不要启动该 Profile。

逐项检查：

- Backend `/health/live` 返回 `alive`，`/health/ready` 返回 `ready`。
- Web 首页可以显示 Backend 状态。
- Admin `/healthz` 返回 `ok`，首页可以显示 Backend 状态。
- 运行容器的镜像引用与批准的完整 digest 一致。
- Web 与 Admin 使用同域 `/api/v1`，认证响应没有 Token 字段，生产 Cookie 包含 `HttpOnly`、`Secure` 和 `SameSite=Lax`。
- 权限目录 `--check` 无漂移；启用请求元数据时消费者能够消费 Redis Stream 并落库。
- 使用 Web 或 Admin 已认证会话上传测试头像，确认资产元数据落库、`/static/uploads/` 可读取、响应包含单个 `X-Content-Type-Options: nosniff`，并确认容器重启后文件仍存在。Admin Nginx 隐藏上游的 `Permissions-Policy`、`Referrer-Policy`、`X-Content-Type-Options` 和 `X-Frame-Options`，统一通过 `add_header ... always` 输出，避免代理响应出现重复值；后端直连仍输出自身安全头。

定期保留清理先执行 dry-run，核对数量并取得数据删除授权后再增加 `--apply`：

```powershell
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.cleanup_security_logs --confirm-database pinjie_fullstack_prod
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.cleanup_security_logs --apply --confirm-database pinjie_fullstack_prod
```

升级到会话设备名称识别版本后，可以先预览旧会话回填数量；核对目标数据库并取得写入授权后再增加 `--apply`：

```powershell
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.backfill_session_device_names --confirm-database pinjie_fullstack_prod
docker compose --env-file .env -f compose.prod.yml run --rm backend python -m scripts.backfill_session_device_names --apply --confirm-database pinjie_fullstack_prod
```

回填只更新空设备名称且能够解析 User-Agent 的记录，重复执行保持幂等。无法解析的记录继续保留为空。

用户回收站没有到期清理或匿名化步骤，软删除记录长期保留并可由具备 `users:restore` 权限的管理员恢复。

## 8. 停止与回滚边界

验证用途的本地容器可执行 `docker compose down`。生产环境只使用发布与部署工作流提供的固定 digest，禁止使用 `latest`、分支标签或临时重建旧版本。项目 Compose 不拥有共享 PostgreSQL 和 Redis，禁止从项目目录停止、删除或重建它们。数据库迁移和恢复需要单独的备份、评审与授权，旧项目专属基础设施在观察期后按独立授权清理。

1Panel 的完整目录、配置、迁移、OpenResty、日志、备份和回滚步骤见[1Panel 单机生产运行手册](1panel-production-runbook.md)。
