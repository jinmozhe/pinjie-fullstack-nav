from dataclasses import dataclass
from enum import StrEnum


@dataclass(frozen=True, slots=True)
class PermissionDefinition:
    code: str
    name: str
    description: str
    assignable_to_roles: bool = True


class PermissionCode(StrEnum):
    NAVIGATION_READ = "navigation:read"
    NAVIGATION_WRITE = "navigation:write"
    NAVIGATION_CREDENTIALS_READ = "navigation:credentials:read"
    NAVIGATION_CREDENTIALS_WRITE = "navigation:credentials:write"
    USERS_READ = "users:read"
    USERS_CREATE = "users:create"
    USERS_UPDATE = "users:update"
    USERS_DELETE = "users:delete"
    USERS_RESTORE = "users:restore"
    USERS_CREDENTIALS_RESET = "users:credentials:reset"
    USERS_SESSIONS_READ = "users:sessions:read"
    USERS_SESSIONS_REVOKE = "users:sessions:revoke"
    ADMINS_READ = "admins:read"
    ADMINS_CREATE = "admins:create"
    ADMINS_UPDATE = "admins:update"
    ADMINS_SUPERUSER_CHANGE = "admins:superuser:change"
    ADMINS_CREDENTIALS_RESET = "admins:credentials:reset"
    ADMINS_ROLES_ASSIGN = "admins:roles:assign"
    ADMINS_SESSIONS_READ = "admins:sessions:read"
    ADMINS_SESSIONS_REVOKE = "admins:sessions:revoke"
    ROLES_READ = "roles:read"
    ROLES_CREATE = "roles:create"
    ROLES_UPDATE = "roles:update"
    ROLES_DELETE = "roles:delete"
    ROLES_PERMISSIONS_ASSIGN = "roles:permissions:assign"
    PERMISSIONS_READ = "permissions:read"
    SECURITY_LOGIN_EVENTS_READ = "security:login-events:read"
    SECURITY_AUDIT_EVENTS_READ = "security:audit-events:read"
    SYSTEM_OVERVIEW_READ = "system:overview:read"
    SYSTEM_REQUEST_LOGS_READ = "system:request-logs:read"
    ASSETS_READ = "assets:read"
    ASSETS_DELETE = "assets:delete"
    SETTINGS_SITE_READ = "settings:site:read"
    SETTINGS_SITE_UPDATE = "settings:site:update"
    SETTINGS_REGISTRATION_READ = "settings:registration:read"
    SETTINGS_REGISTRATION_UPDATE = "settings:registration:update"


PERMISSION_CATALOG: tuple[PermissionDefinition, ...] = (
    PermissionDefinition("navigation:read", "查看导航管理", "查看分类、标签、站点及回收站"),
    PermissionDefinition("navigation:write", "维护导航", "新增修改分类、标签、站点及批量生命周期操作"),
    PermissionDefinition("navigation:credentials:read", "查阅外网凭据", "在 Admin 或 Web 查阅全部外网帐号密码"),
    PermissionDefinition("navigation:credentials:write", "维护外网凭据", "在 Admin 新增修改删除外网帐号资料"),
    PermissionDefinition("users:read", "查看用户", "查看用户列表和详情"),
    PermissionDefinition("users:create", "创建用户", "创建普通用户账户"),
    PermissionDefinition("users:update", "修改用户", "修改用户资料和状态"),
    PermissionDefinition("users:delete", "删除用户", "将用户账户移入回收站"),
    PermissionDefinition("users:restore", "恢复用户", "从回收站恢复软删除用户账户"),
    PermissionDefinition("users:credentials:reset", "重置用户密码", "重置用户登录密码"),
    PermissionDefinition("users:sessions:read", "查看用户会话", "查看用户设备与会话"),
    PermissionDefinition("users:sessions:revoke", "撤销用户会话", "撤销用户一个或全部会话"),
    PermissionDefinition("admins:read", "查看管理员", "查看管理员列表和详情"),
    PermissionDefinition("admins:create", "创建管理员", "创建后台管理员"),
    PermissionDefinition("admins:update", "修改管理员资料与状态", "修改管理员资料和启用状态"),
    PermissionDefinition(
        "admins:superuser:change",
        "设为超级管理员",
        "仅超级管理员可授予或取消其他管理员的超级管理员身份",
        assignable_to_roles=False,
    ),
    PermissionDefinition("admins:credentials:reset", "重置管理员密码", "重置管理员登录密码"),
    PermissionDefinition("admins:roles:assign", "分配管理员角色", "修改管理员角色集合"),
    PermissionDefinition("admins:sessions:read", "查看管理员会话", "查看管理员会话"),
    PermissionDefinition("admins:sessions:revoke", "撤销管理员会话", "撤销管理员全部会话"),
    PermissionDefinition("roles:read", "查看角色", "查看角色和授权"),
    PermissionDefinition("roles:create", "创建角色", "创建后台角色"),
    PermissionDefinition("roles:update", "修改角色", "修改角色资料和状态"),
    PermissionDefinition("roles:delete", "删除角色", "删除未被使用的角色"),
    PermissionDefinition("roles:permissions:assign", "分配角色权限", "修改角色权限集合"),
    PermissionDefinition("permissions:read", "查看权限目录", "查看源码权限目录"),
    PermissionDefinition("security:login-events:read", "查看登录事件", "查看登录安全事件"),
    PermissionDefinition("security:audit-events:read", "查看审计事件", "查看高风险操作审计"),
    PermissionDefinition("system:overview:read", "查看系统概览", "查看系统健康状态、运行配置摘要和业务遥测"),
    PermissionDefinition("system:request-logs:read", "查看请求日志", "查看启用后的请求元数据"),
    PermissionDefinition("assets:read", "查看文件资产", "查看统一文件与多媒体资产列表"),
    PermissionDefinition("assets:delete", "删除文件资产", "删除文件资产及其存储对象"),
    PermissionDefinition("settings:site:read", "查看站点设置", "查看 Web 公共站点资料和 LOGO"),
    PermissionDefinition("settings:site:update", "修改站点设置", "修改 Web 公共站点资料和 LOGO"),
    PermissionDefinition("settings:registration:read", "查看注册设置", "查看 Web 公开注册开关"),
    PermissionDefinition("settings:registration:update", "修改注册设置", "修改 Web 公开注册开关"),
)

PERMISSION_CODES = frozenset(item.code for item in PERMISSION_CATALOG)
ROLE_ASSIGNABLE_PERMISSION_CODES = frozenset(item.code for item in PERMISSION_CATALOG if item.assignable_to_roles)
CATALOG_VERSION = "2026-09-06.1"

__all__ = [
    "CATALOG_VERSION",
    "PERMISSION_CATALOG",
    "PERMISSION_CODES",
    "ROLE_ASSIGNABLE_PERMISSION_CODES",
    "PermissionCode",
    "PermissionDefinition",
]
