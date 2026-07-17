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
