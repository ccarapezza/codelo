// Uso/créditos de las APIs de IA para mostrar en Site Settings.
//
// OpenRouter: la API key normal SÍ expone créditos/uso →
//   GET /api/v1/credits   { total_credits, total_usage }   (cuenta)
//   GET /api/v1/key       { usage, usage_daily/weekly/monthly }  (este key)
//
// OpenAI: la secret key NO expone saldo (OpenAI lo limita a session keys del
// navegador). Solo una Admin key (sk-admin-) vía la Costs API daría *costo*
// (no saldo). Sin eso, devolvemos un link al dashboard. Si está seteada
// OPENAI_ADMIN_KEY intentamos traer el costo del mes en curso.
import { requireAdmin } from "../../../lib/admin-auth";

async function fetchJson(url: string, key: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const round = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? +n.toFixed(4) : null;

export default ({ strapi }: { strapi: any }) => ({
  async ai(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;

    // ── OpenRouter ──────────────────────────────────────────────────────
    const orKey = process.env.OPENROUTER_API_KEY?.trim();
    let openrouter: Record<string, unknown> = { ok: false, configured: Boolean(orKey) };
    if (orKey) {
      const [credits, keyInfo] = await Promise.all([
        fetchJson("https://openrouter.ai/api/v1/credits", orKey),
        fetchJson("https://openrouter.ai/api/v1/key", orKey),
      ]);
      const total = round(credits?.data?.total_credits);
      const used = round(credits?.data?.total_usage);
      const k = keyInfo?.data ?? {};
      openrouter = {
        ok: total != null && used != null,
        configured: true,
        totalCredits: total,
        totalUsage: used,
        remaining: total != null && used != null ? +(total - used).toFixed(4) : null,
        keyUsage: {
          total: round(k.usage),
          daily: round(k.usage_daily),
          weekly: round(k.usage_weekly),
          monthly: round(k.usage_monthly),
        },
      };
    }

    // ── OpenAI ──────────────────────────────────────────────────────────
    const oaKey = process.env.OPENAI_API_KEY?.trim();
    const adminKey = process.env.OPENAI_ADMIN_KEY?.trim();
    const openai: Record<string, unknown> = {
      ok: false,
      configured: Boolean(oaKey),
      // El saldo NO es accesible con la secret key (OpenAI lo restringe).
      reason: "La API key no expone saldo/créditos (OpenAI lo limita a session keys del navegador).",
      dashboardUrl: "https://platform.openai.com/usage",
    };
    if (adminKey) {
      // Costo del mes en curso vía Costs API (requiere Admin key).
      const startOfMonth = Math.floor(new Date(new Date().toISOString().slice(0, 7) + "-01T00:00:00Z").getTime() / 1000);
      const data = await fetchJson(`https://api.openai.com/v1/organization/costs?start_time=${startOfMonth}&limit=180`, adminKey);
      const buckets = (data?.data ?? []) as Array<{ results?: Array<{ amount?: { value?: number } }> }>;
      let monthCost = 0;
      let any = false;
      for (const b of buckets) for (const r of b.results ?? []) {
        if (typeof r.amount?.value === "number") { monthCost += r.amount.value; any = true; }
      }
      if (any) {
        openai.ok = true;
        openai.monthlyCost = +monthCost.toFixed(4);
        openai.reason = "Costo del mes en curso (vía Admin key). OpenAI no expone un saldo disponible.";
      }
    }

    ctx.body = { openrouter, openai };
  },
});
