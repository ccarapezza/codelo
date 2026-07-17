// Simple in-memory rate limiter for public /api/* endpoints.
// Single-instance deployment, no Redis. Sliding window per IP.

type Bucket = { count: number; resetAt: number };

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

const buckets = new Map<string, Bucket>();

function getClientIp(ctx: any): string {
  return (
    (ctx.request?.header?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    ctx.request?.ip ||
    ctx.ip ||
    "unknown"
  );
}

export default (config: { windowMs?: number; max?: number; pathPrefix?: string } = {}, { strapi }: any) => {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const max = config.max ?? DEFAULT_MAX;
  const pathPrefix = config.pathPrefix ?? "/api/";

  return async (ctx: any, next: () => Promise<any>) => {
    if (!ctx.path?.startsWith(pathPrefix)) {
      return next();
    }

    const key = `${getClientIp(ctx)}|${ctx.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > max) {
        ctx.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
        ctx.status = 429;
        ctx.body = { error: "Too many requests" };
        strapi?.log?.warn(`[rate-limit] ${key} blocked (${bucket.count}/${max})`);
        return;
      }
    }

    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k);
      }
    }

    await next();
  };
};
