import type { AdminInitialState } from "./app";

export default function access(initialState?: AdminInitialState) {
  const admin = initialState?.currentAdmin;
  return {
    canNavigation: Boolean(admin && (admin.is_superuser || admin.permissions.includes("navigation:read"))),
    canUsers: Boolean(admin && (admin.is_superuser || admin.permissions.includes("users:read"))),
    canAdmins: Boolean(admin && (admin.is_superuser || admin.permissions.includes("admins:read"))),
    canRoles: Boolean(admin && (admin.is_superuser || admin.permissions.includes("roles:read"))),
    canAssets: Boolean(admin && (admin.is_superuser || admin.permissions.includes("assets:read"))),
    canSettings: Boolean(admin && (admin.is_superuser || [
      "settings:site:read",
      "settings:registration:read",
    ].some((permission) => admin.permissions.includes(permission)))),
    canSystem: Boolean(admin && (admin.is_superuser || admin.permissions.includes("system:overview:read"))),
    canSecurity: Boolean(admin && (admin.is_superuser || [
      "security:login-events:read",
      "security:audit-events:read",
      "system:request-logs:read",
    ].some((permission) => admin.permissions.includes(permission)))),
  };
}
