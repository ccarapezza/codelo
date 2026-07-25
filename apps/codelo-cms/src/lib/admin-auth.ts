// Inline admin-JWT verification helper. Used by /api/* admin endpoints
// where Strapi's middleware/policy plumbing for admin auth has proven
// fragile (the global middleware never seems to fire when referenced from
// route config, and `admin::isAuthenticatedAdmin` policy alone rejects
// without a valid auth context).
//
// Mirrors what @strapi/admin's auth strategy does internally:
//   - validates the Bearer access token via the admin sessionManager,
//   - checks the session is still active (so revoked logins are blocked),
//   - confirms the user exists and is active.
// On success, populates ctx.state.user so downstream code can read it.
// On any failure, sets the appropriate 401 on ctx and returns false.
// The caller must `return` immediately when this helper returns false.

export async function requireAdmin(ctx: any, strapi: any): Promise<boolean> {
  const header = ctx.request?.headers?.authorization;
  if (!header || typeof header !== "string") {
    ctx.unauthorized();
    return false;
  }
  const parts = header.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    ctx.unauthorized();
    return false;
  }
  const token = parts[1];

  const manager = strapi.sessionManager?.("admin");
  if (!manager) {
    strapi.log.error("[admin-auth] sessionManager('admin') not available");
    ctx.unauthorized();
    return false;
  }

  const result = manager.validateAccessToken(token);
  if (!result?.isValid) {
    ctx.unauthorized();
    return false;
  }

  const isActive = await manager.isSessionActive(result.payload.sessionId);
  if (!isActive) {
    ctx.unauthorized();
    return false;
  }

  const rawUserId = result.payload.userId;
  const numericUserId = Number(rawUserId);
  const userId =
    Number.isFinite(numericUserId) && String(numericUserId) === String(rawUserId)
      ? numericUserId
      : rawUserId;

  const user = await strapi.db.query("admin::user").findOne({ where: { id: userId } });
  if (!user || user.isActive !== true || user.blocked === true) {
    ctx.unauthorized();
    return false;
  }

  ctx.state.user = user;
  return true;
}

const SUPER_ADMIN_ROLE_CODE = "strapi-super-admin";

// requireAdmin() + una acción RBAC concreta (ver lib/admin-permissions.ts).
// requireAdmin() sola sólo prueba "es un admin activo": la tiene también un
// Editor o un Author, así que no alcanza para las pantallas de configuración.
//
// Pasa si el usuario es super admin (chequeo por código de rol: es la intención
// declarada y no depende de que la sincronización de permisos del boot haya
// corrido bien) o si alguno de sus roles tiene concedida la acción.
// Falla con 403 —no 401— porque el usuario está autenticado: lo que falta es
// permiso, y devolver 401 haría que el panel lo mande a re-loguearse en loop.
export async function requireAdminPermission(
  ctx: any,
  strapi: any,
  action: string,
): Promise<boolean> {
  if (!(await requireAdmin(ctx, strapi))) return false;

  const userId = ctx.state.user.id;
  const roles = await strapi.db
    .query("admin::role")
    .findMany({ where: { users: { id: userId } }, select: ["code"] });
  if (roles.some((role: { code?: string }) => role?.code === SUPER_ADMIN_ROLE_CODE)) {
    return true;
  }

  const granted = await strapi.db
    .query("admin::permission")
    .findOne({ where: { action, role: { users: { id: userId } } } });
  if (!granted) {
    ctx.forbidden();
    return false;
  }
  return true;
}
