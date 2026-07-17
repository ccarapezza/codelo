// Match-context module for the "analyst" agent.
//
// ARCHITECTURE: the CMS must NOT import `@fulbo/db`. Its DATABASE_URL points at
// Strapi's own Postgres, so the shared Prisma client would connect to the wrong
// DB. Instead we fetch match data over HTTP from the web app's internal API
// (guarded by INTERNAL_API_KEY) and mirror the JSON shape with LOCAL interfaces.
//
// These interfaces are a SUBSET of MatchFullDetail / RecentFinishedMatch in
// packages/db/src/match.ts — only the fields the digest actually uses. They are
// duplicated on purpose to keep the CMS free of the @fulbo/db dependency.

import { toEsCountry } from "./country-names";

// ── Env resolution ──────────────────────────────────────────────────────────

// Base URL of the web app exposing /api/internal/*. Defaults to prod.
function getWebInternalUrl(): string {
  return (process.env.WEB_INTERNAL_URL?.trim() || "https://x100.example").replace(/\/+$/, "");
}

// Shared secret; must match the web app's INTERNAL_API_KEY. Throwing here lets
// the caller catch + skip, so a misconfig no-ops the cron instead of crashing.
function getInternalApiKey(): string {
  const key = process.env.INTERNAL_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "INTERNAL_API_KEY is not configured — the analyst agent cannot reach the web internal API.",
    );
  }
  return key;
}

// ── JSON shapes (mirror of the web internal endpoints) ──────────────────────

export interface RecentFinishedMatchJson {
  matchId: string;
  kickoffAt: string | null;
  leagueName: string;
  stage: string | null;
  home: { name: string; slug: string; score: number | null } | null;
  away: { name: string; slug: string; score: number | null } | null;
}

export interface MatchEventJson {
  minute: number;
  extraMinute: number;
  type: string; // MatchEventType as a string ("GOAL", "OWN_GOAL", "YELLOW_CARD", "RED_CARD", ...)
  side: "home" | "away" | "neutral";
  playerName: string | null;
}

export interface MatchTeamStatsJson {
  formation: string | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  possessionPct: number | null;
  yellowCards: number | null;
  redCards: number | null;
  expectedGoals: number | null;
}

export interface LineupPlayerJson {
  name: string;
  rating: number | null;
}

export interface TeamLineupJson {
  formation: string | null;
  starters: LineupPlayerJson[];
  bench: LineupPlayerJson[];
}

export interface MatchTeamRefJson {
  name: string;
  score: number | null;
  shootoutScore: number | null;
}

export interface MatchDetailJson {
  matchId: string;
  leagueName: string;
  stage: string | null;
  kickoffAt: string | null;
  venue: string | null;
  attendance: number | null;
  decidedAfterExtraTime: boolean;
  decidedByShootout: boolean;
  home: MatchTeamRefJson | null;
  away: MatchTeamRefJson | null;
  events: MatchEventJson[];
  teamStats: { home: MatchTeamStatsJson | null; away: MatchTeamStatsJson | null };
  lineups: { home: TeamLineupJson | null; away: TeamLineupJson | null };
  hasRatings: boolean;
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5000;

async function internalFetch(path: string): Promise<Response> {
  const base = getWebInternalUrl();
  const key = getInternalApiKey();
  return fetch(`${base}${path}`, {
    headers: { "x-internal-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export async function fetchRecentFinishedMatches(
  sinceDays?: number,
  max?: number,
): Promise<RecentFinishedMatchJson[]> {
  const qs = new URLSearchParams();
  if (sinceDays != null) qs.set("sinceDays", String(sinceDays));
  if (max != null) qs.set("max", String(max));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await internalFetch(`/api/internal/recent-finished-matches${suffix}`);
  if (!res.ok) {
    throw new Error(`recent-finished-matches fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as RecentFinishedMatchJson[];
}

export async function fetchMatchDetail(matchId: string): Promise<MatchDetailJson | null> {
  const res = await internalFetch(`/api/internal/match/${encodeURIComponent(matchId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`match detail fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as MatchDetailJson;
}

// ── Deterministic Spanish digest (the ground truth for the LLM) ─────────────

function fmtMinute(e: { minute: number; extraMinute: number }): string {
  return e.extraMinute && e.extraMinute > 0 ? `${e.minute}+${e.extraMinute}'` : `${e.minute}'`;
}

function fmtNum(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  // xG-style decimals → one place; integers stay integer.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const GOAL_TYPES = new Set(["GOAL", "PENALTY_GOAL"]);

/**
 * Whether a finished match has its marquee advanced stats populated. The
 * analyst's value is xG + player ratings; data providers fill these in a few
 * hours AFTER full time, so a match analyzed too early would have a digest full
 * of "s/d". The analyst only AUTO-PUBLISHES when this is true; otherwise it
 * leaves the analysis as a draft for human review.
 */
export function isMatchStatsComplete(detail: MatchDetailJson): boolean {
  const h = detail.teamStats?.home;
  const a = detail.teamStats?.away;
  return (
    detail.hasRatings === true &&
    h?.expectedGoals != null &&
    a?.expectedGoals != null
  );
}

/**
 * Build a DETERMINISTIC, purely factual Spanish digest (bullet list) from the
 * match detail. No adjectives, no interpretation — just the numbers/facts. This
 * is the ONLY ground truth the LLM is allowed to write from.
 */
export function buildMatchStatsDigest(detail: MatchDetailJson): string {
  const lines: string[] = [];
  // Localize team names to Spanish so the digest (the model's only ground truth)
  // never feeds it the English DB form ("England" → "Inglaterra"). Every other
  // line below references these, so this single point covers the whole digest.
  const homeName = toEsCountry(detail.home?.name) || "Local";
  const awayName = toEsCountry(detail.away?.name) || "Visitante";
  const hs = detail.home?.score;
  const as = detail.away?.score;

  // Result.
  let resultLine = `Resultado final: ${homeName} ${hs ?? "?"} - ${as ?? "?"} ${awayName}`;
  if (detail.decidedByShootout) {
    const hp = detail.home?.shootoutScore;
    const ap = detail.away?.shootoutScore;
    if (hp != null && ap != null) {
      resultLine += ` (definido por penales ${hp}-${ap})`;
    } else {
      resultLine += " (definido por penales)";
    }
  } else if (detail.decidedAfterExtraTime) {
    resultLine += " (definido en tiempo suplementario)";
  }
  lines.push(`- ${resultLine}`);

  if (detail.leagueName) {
    lines.push(`- Competencia: ${detail.leagueName}${detail.stage ? ` — ${detail.stage}` : ""}`);
  }

  // Goal scorers (exclude own goals from a scorer's tally; list them apart).
  const events = detail.events ?? [];
  const goals = events.filter((e) => GOAL_TYPES.has(e.type));
  const ownGoals = events.filter((e) => e.type === "OWN_GOAL");
  if (goals.length > 0) {
    const fmtSide = (side: "home" | "away") =>
      goals
        .filter((g) => g.side === side)
        .map((g) => `${g.playerName ?? "?"} ${fmtMinute(g)}`)
        .join(", ");
    const homeGoals = fmtSide("home");
    const awayGoals = fmtSide("away");
    if (homeGoals) lines.push(`- Goles ${homeName}: ${homeGoals}`);
    if (awayGoals) lines.push(`- Goles ${awayName}: ${awayGoals}`);
  }
  if (ownGoals.length > 0) {
    lines.push(
      `- Goles en contra: ${ownGoals
        .map((g) => `${g.playerName ?? "?"} ${fmtMinute(g)}`)
        .join(", ")}`,
    );
  }

  const home = detail.teamStats?.home;
  const away = detail.teamStats?.away;

  // xG.
  const hxg = fmtNum(home?.expectedGoals);
  const axg = fmtNum(away?.expectedGoals);
  if (hxg != null || axg != null) {
    lines.push(`- xG (goles esperados): ${homeName} ${hxg ?? "s/d"} — ${awayName} ${axg ?? "s/d"}`);
  }

  // Possession.
  const hpos = fmtNum(home?.possessionPct);
  const apos = fmtNum(away?.possessionPct);
  if (hpos != null || apos != null) {
    lines.push(`- Posesión: ${homeName} ${hpos ?? "s/d"}% — ${awayName} ${apos ?? "s/d"}%`);
  }

  // Shots (total / on target).
  const shotsLine = (s: MatchTeamStatsJson | null | undefined): string | null => {
    if (!s) return null;
    const total = fmtNum(s.shotsTotal);
    const on = fmtNum(s.shotsOnTarget);
    if (total == null && on == null) return null;
    return `${total ?? "s/d"} remates (${on ?? "s/d"} al arco)`;
  };
  const hShots = shotsLine(home);
  const aShots = shotsLine(away);
  if (hShots || aShots) {
    lines.push(`- Remates: ${homeName} ${hShots ?? "s/d"} — ${awayName} ${aShots ?? "s/d"}`);
  }

  // Cards (yellows count + explicit red cards with minute & team from events).
  const hy = home?.yellowCards;
  const ay = away?.yellowCards;
  if ((hy != null && hy > 0) || (ay != null && ay > 0)) {
    lines.push(`- Amarillas: ${homeName} ${hy ?? 0} — ${awayName} ${ay ?? 0}`);
  }
  const reds = events.filter((e) => e.type === "RED_CARD" || e.type === "SECOND_YELLOW");
  if (reds.length > 0) {
    lines.push(
      `- Rojas: ${reds
        .map((r) => {
          const team = r.side === "home" ? homeName : r.side === "away" ? awayName : "?";
          return `${r.playerName ?? "?"} (${team}) ${fmtMinute(r)}`;
        })
        .join(", ")}`,
    );
  }

  // Top 2-3 players by rating (only when ratings are available).
  if (detail.hasRatings) {
    type Rated = { name: string; rating: number; team: string };
    const collect = (lineup: TeamLineupJson | null, team: string): Rated[] => {
      if (!lineup) return [];
      return [...(lineup.starters ?? []), ...(lineup.bench ?? [])]
        .filter((p): p is LineupPlayerJson & { rating: number } => p.rating != null)
        .map((p) => ({ name: p.name, rating: p.rating, team }));
    };
    const rated = [
      ...collect(detail.lineups?.home ?? null, homeName),
      ...collect(detail.lineups?.away ?? null, awayName),
    ]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    if (rated.length > 0) {
      lines.push(
        `- Mejores puntajes: ${rated
          .map((p) => `${p.name} (${p.team}, ${p.rating.toFixed(1)})`)
          .join(", ")}`,
      );
    }
  }

  // Formations.
  const hf = detail.lineups?.home?.formation ?? home?.formation ?? null;
  const af = detail.lineups?.away?.formation ?? away?.formation ?? null;
  if (hf || af) {
    lines.push(`- Formaciones: ${homeName} ${hf ?? "s/d"} — ${awayName} ${af ?? "s/d"}`);
  }

  // Context.
  const ctx: string[] = [];
  if (detail.venue) ctx.push(`Estadio: ${detail.venue}`);
  if (detail.attendance != null && detail.attendance > 0) {
    ctx.push(`Asistencia: ${detail.attendance.toLocaleString("es-AR")}`);
  }
  if (ctx.length > 0) lines.push(`- ${ctx.join(" · ")}`);

  return lines.join("\n");
}
