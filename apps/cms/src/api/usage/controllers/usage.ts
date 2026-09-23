// Uso y costo de las APIs de IA, para Sitio e integraciones.
//
// Las dos cuentas no se parecen y la pantalla no tiene que fingir que sí:
//
//   OpenRouter es PREPAGO. La API key normal expone saldo:
//     GET /api/v1/credits   { total_credits, total_usage }   → disponible
//     GET /api/v1/key       { usage, usage_daily/weekly/monthly }
//
//   OpenAI es POSPAGO. Ningún endpoint devuelve créditos restantes; no es que
//   no lo hayamos encontrado, no existe. Lo máximo es CONSUMO, y sólo con una
//   Admin key (`sk-admin-…`), que es distinta de la key de la aplicación:
//     GET /v1/organization/costs              → dólares
//     GET /v1/organization/usage/completions  → tokens y requests
//     GET /v1/organization/usage/images       → imágenes y requests
//
// Por eso OpenRouter muestra barra de saldo y OpenAI no: no hay barra que
// mostrar, y una inventada sería peor que ninguna.
//
// Todo falla suave: la tarjeta es informativa y ninguna de estas llamadas debe
// poder romper la pantalla de configuración.
import { requireAdmin } from "../../../lib/admin-auth";
import { consumoDelMes } from "../../../lib/openai-usage";

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
    // El texto dice QUÉ falta y dónde se consigue. Antes decía "saldo no
    // disponible" para todos los casos, y eso hacía parecer un límite de OpenAI
    // lo que en realidad era una variable de entorno sin poner — que además no
    // estaba en ningún compose ni .env.example, así que no había forma de
    // enterarse de que existía.
    const openai: Record<string, unknown> = {
      ok: false,
      configured: Boolean(oaKey),
      hasAdminKey: Boolean(adminKey),
      reason: !oaKey
        ? "Falta OPENAI_API_KEY en el entorno del CMS. Sin ella no se genera nada."
        : "Falta OPENAI_ADMIN_KEY: una clave de organización (sk-admin-…), distinta de la de la aplicación. Se crea en Settings → Organization → Admin keys. Es opcional: sin ella todo funciona, sólo no se ve el consumo.",
      dashboardUrl: "https://platform.openai.com/usage",
    };

    if (adminKey) {
      const consumo = await consumoDelMes(adminKey);
      // Un mes recién arrancado devuelve listas vacías, y eso no es un error:
      // con la clave puesta la respuesta es válida aunque el consumo sea cero.
      openai.ok = true;
      openai.monthlyCost = consumo.monthlyCost;
      openai.models = consumo.models;
      openai.reason =
        "Consumo del mes en curso. OpenAI es pospago: no publica un saldo disponible por API.";
    }

    ctx.body = { openrouter, openai };
  },
});
