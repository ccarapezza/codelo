// Aggregations behind the /semillas panel.
//
// Pure functions over the mirrored cultivar list — no I/O — so the numbers on
// the page can be unit-tested against the real catalogue instead of eyeballed.
// Every figure shown to a reader comes from here; nothing is hardcoded in JSX.

import type { Cultivar } from "./semillas";

export type AltasPorAnio = {
  anio: string;
  /** Registrations in the RNC — what authorises commercial sale. */
  rnc: number;
  /** Property titles in the RNPC — 20-year breeder's right. */
  rnpc: number;
};

const anioDe = (iso: string | null): string | null =>
  iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : null;

/**
 * Registrations per year in both registries.
 *
 * Both series count the same unit (cultivars registered), so they share one
 * axis. This is deliberate: plotting them against two scales would invent a
 * relationship the data does not have.
 */
export function altasPorAnio(cultivares: Cultivar[]): AltasPorAnio[] {
  const porAnio = new Map<string, { rnc: number; rnpc: number }>();
  const bump = (anio: string | null, key: "rnc" | "rnpc") => {
    if (!anio) return;
    const row = porAnio.get(anio) ?? { rnc: 0, rnpc: 0 };
    row[key] += 1;
    porAnio.set(anio, row);
  };

  for (const c of cultivares) {
    bump(anioDe(c.inscripcionRnc), "rnc");
    bump(anioDe(c.inscripcionRnpc), "rnpc");
  }

  const anios = [...porAnio.keys()].sort();
  if (anios.length === 0) return [];

  // Fill the gaps. A year with zero registrations is the most interesting thing
  // this dataset has to say (2024), and dropping it would hide exactly that.
  const desde = Number(anios[0]);
  const hasta = Number(anios[anios.length - 1]);
  const out: AltasPorAnio[] = [];
  for (let a = desde; a <= hasta; a++) {
    const key = String(a);
    const row = porAnio.get(key) ?? { rnc: 0, rnpc: 0 };
    out.push({ anio: key, ...row });
  }
  return out;
}

export type Cobertura = {
  conRnc: number;
  conRnpc: number;
  ambos: number;
  soloRnc: number;
  soloRnpc: number;
  total: number;
};

/** How many cultivars hold each registry, and how many hold both. */
export function cobertura(cultivares: Cultivar[]): Cobertura {
  const conRnc = cultivares.filter(c => c.inscripcionRnc).length;
  const conRnpc = cultivares.filter(c => c.inscripcionRnpc).length;
  const ambos = cultivares.filter(c => c.inscripcionRnc && c.inscripcionRnpc).length;
  return {
    conRnc,
    conRnpc,
    ambos,
    soloRnc: conRnc - ambos,
    soloRnpc: conRnpc - ambos,
    total: cultivares.length,
  };
}

export type Conteo = { etiqueta: string; valor: number };

/**
 * Split by species.
 *
 * INASE spells it `CANNABIS` or `CAÑAMO` depending on the row; both are
 * *Cannabis sativa* L. and the distinction is regulatory (hemp is under 1% THC),
 * so it is worth showing rather than collapsing.
 */
export function porEspecie(cultivares: Cultivar[]): Conteo[] {
  const conteo = new Map<string, number>();
  for (const c of cultivares) {
    const k = (c.especie ?? "Sin especificar").trim() || "Sin especificar";
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Breeders ranked by how many cultivars they registered.
 *
 * Falls back to the RNPC applicant when there is no RNC one: 11 cultivars hold
 * only a property title, and dropping them would under-count real breeders.
 */
export function topObtentores(cultivares: Cultivar[], limite = 8): Conteo[] {
  const conteo = new Map<string, number>();
  for (const c of cultivares) {
    const nombre = (c.solicitanteRnc || c.solicitanteRnpc || "").trim();
    if (!nombre) continue;
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta))
    .slice(0, limite);
}

/** Cultivars whose origin is not Argentina, by country code. */
export function porOrigen(cultivares: Cultivar[]): { nacionales: number; importados: number } {
  const nacionales = cultivares.filter(c => (c.codPais ?? "").toUpperCase() === "ARG").length;
  return { nacionales, importados: cultivares.length - nacionales };
}
