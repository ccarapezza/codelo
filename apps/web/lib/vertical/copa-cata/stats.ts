// Cuentas de la Copa Cata del Oeste.
//
// Funciones puras sobre las ediciones y el palmarés —sin I/O— para que cada
// cifra que imprime la sección se pueda probar contra los datos reales en vez
// de mirarla a ojo. Reglas que atraviesan todo el archivo:
//
// - `null` no es 0: una celda sin palmarés no "entregó cero premios".
// - Las recurrencias se cuentan por clave, nunca por el texto: dos "Pablo"
//   son dos personas salvo que una `ganadorClave` diga lo contrario.
// - Solo existen los años con edición (`Anio`).

import { CATEGORIAS, FAMILIAS, FAMILIA_DE } from "./tipos";
import type { Anio, Categoria, Edicion, Familia, Premio } from "./tipos";

/** Para comparar textos: sin tildes, en minúscula y con un solo espacio. */
export function fold(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave estable a partir de un nombre: "L.A. Amnesia" → "l-a-amnesia". */
export function slug(texto: string): string {
  return fold(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const porAnio = <T extends { anio: Anio }>(a: T, b: T) => a.anio - b.anio;

export type PremiosEnCategoria = { categoria: Categoria; familia: Familia; premios: number };

/**
 * Premios por categoría, agrupados por familia (flores, extractos, otros) y,
 * dentro de cada una, de más a menos. Las categorías sin premios no aparecen.
 */
export function premiosPorCategoria(premios: readonly Premio[]): PremiosEnCategoria[] {
  const conteo = new Map<Categoria, number>();
  for (const p of premios) conteo.set(p.categoria, (conteo.get(p.categoria) ?? 0) + 1);
  return CATEGORIAS.filter((c) => conteo.has(c))
    .map((categoria) => ({
      categoria,
      familia: FAMILIA_DE[categoria],
      premios: conteo.get(categoria) ?? 0,
    }))
    .sort(
      (a, b) =>
        FAMILIAS.indexOf(a.familia) - FAMILIAS.indexOf(b.familia) ||
        b.premios - a.premios ||
        CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria),
    );
}

export type Recurrencia = {
  clave: string;
  /** La forma publicada más frecuente; si empatan, la más reciente. */
  nombre: string;
  /**
   * La búsqueda del palmarés que trae todas las filas del grupo: las palabras
   * del nombre que están en todas sus formas. "Nombre Otra Marca" y "Nombre
   * de Tal Grow" dan "Nombre"; con el nombre entero, el filtro perdería una.
   */
  busqueda: string;
  premios: number;
  ediciones: Anio[];
};

/** Las palabras de un texto, sin tildes ni mayúsculas. */
const palabras = (texto: string) => new Set(fold(texto).split(" "));

function agrupar(
  premios: readonly Premio[],
  clave: (p: Premio) => string | null,
  nombre: (p: Premio) => string | null,
): Recurrencia[] {
  const grupos = new Map<string, Premio[]>();
  for (const p of premios) {
    const k = clave(p);
    if (k === null) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const out: Recurrencia[] = [];
  for (const [k, filas] of grupos) {
    const formas = new Map<string, { veces: number; ultima: number }>();
    for (const p of filas) {
      const n = nombre(p);
      if (n === null) continue;
      const f = formas.get(n) ?? { veces: 0, ultima: 0 };
      formas.set(n, { veces: f.veces + 1, ultima: Math.max(f.ultima, p.edicion) });
    }
    const [masUsada] = [...formas.entries()].sort(
      ([, a], [, b]) => b.veces - a.veces || b.ultima - a.ultima,
    );
    const elegido = masUsada?.[0] ?? k;
    const todas = [...formas.keys()].map(palabras);
    const comunes = elegido.split(/\s+/).filter((w) => todas.every((ws) => ws.has(fold(w))));
    out.push({
      clave: k,
      nombre: elegido,
      busqueda: comunes.length > 0 ? comunes.join(" ") : elegido,
      premios: filas.length,
      ediciones: [...new Set(filas.map((p) => p.edicion))].sort((a, b) => a - b),
    });
  }
  return out.sort(
    (a, b) =>
      b.premios - a.premios ||
      b.ediciones.length - a.ediciones.length ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}

/** Genéticas premiadas más de una vez (o `minimo` veces), unificadas por `geneticaClave`. */
export function geneticasRepetidas(premios: readonly Premio[], minimo = 2): Recurrencia[] {
  return agrupar(
    premios,
    (p) => p.geneticaClave,
    (p) => p.genetica,
  ).filter((r) => r.premios >= minimo);
}

/**
 * Quiénes repitieron premio, por `ganadorClave`: personas, colectivos o
 * comercios, con la misma regla. Una fila sin clave no se une a ninguna.
 */
export function ganadoresRecurrentes(premios: readonly Premio[], minimo = 2): Recurrencia[] {
  return agrupar(
    premios,
    (p) => p.ganadorClave,
    (p) => p.ganador,
  ).filter((r) => r.premios >= minimo);
}

/** Bancos de las genéticas premiadas, por `bancoClave`; los datos en disputa no cuentan. */
export function bancosMasPremiados(premios: readonly Premio[], limite?: number): Recurrencia[] {
  const todos = agrupar(
    premios,
    (p) => p.bancoClave,
    (p) => p.banco,
  );
  return limite === undefined ? todos : todos.slice(0, limite);
}

export type Records = {
  /** Quien más premios ganó (por `ganadorClave`), con las copas en que lo hizo. */
  ganador: Recurrencia[];
  /** La genética más premiada (por `geneticaClave`). */
  genetica: Recurrencia[];
  /** El banco con más premios entre las genéticas premiadas (por `bancoClave`). */
  banco: Recurrencia[];
};

/**
 * Los récords de la Copa. Cada uno es la punta de su lista: si dos empatan en
 * premios, van los dos. Un récord necesita al menos dos premios; si nadie
 * repite, la lista queda vacía y el récord no se muestra.
 */
export function records(premios: readonly Premio[]): Records {
  const punta = (lista: Recurrencia[]) => {
    const max = lista[0]?.premios ?? 0;
    return max >= 2 ? lista.filter((r) => r.premios === max) : [];
  };
  return {
    ganador: punta(ganadoresRecurrentes(premios)),
    genetica: punta(geneticasRepetidas(premios)),
    banco: punta(bancosMasPremiados(premios)),
  };
}

export type MatrizCategorias = {
  anios: Anio[];
  filas: Array<{
    categoria: Categoria;
    familia: Familia;
    /** Premios de esa categoría ese año: 0 = no se premió; `null` = sin registro. */
    celdas: Array<{ anio: Anio; premios: number | null }>;
  }>;
};

/** Qué se premió cada año, en las ediciones que recibe (la página le pasa las que tienen palmarés). */
export function matrizCategorias(
  ediciones: readonly Edicion[],
  premios: readonly Premio[],
): MatrizCategorias {
  const orden = [...ediciones].sort(porAnio);
  const presentes = premiosPorCategoria(premios);
  return {
    anios: orden.map((e) => e.anio),
    filas: presentes.map(({ categoria, familia }) => ({
      categoria,
      familia,
      celdas: orden.map((e) => ({
        anio: e.anio,
        premios:
          e.palmares.fuentes.length === 0
            ? null
            : premios.filter((p) => p.edicion === e.anio && p.categoria === categoria).length,
      })),
    })),
  };
}

export type EnNumeros = {
  ediciones: number;
  premios: number;
  /** Genéticas distintas, por `geneticaClave`. */
  geneticas: number;
  /**
   * Ganadores distintos: personas, colectivos y comercios. Una clave cuenta
   * una vez; cada fila sin clave cuenta como alguien distinto, porque no se
   * afirma identidad entre nombres iguales sin una razón anotada.
   */
  ganadores: number;
  marcas: { min: number; max: number };
  desde: Anio;
  hasta: Anio;
};

export function enNumeros(ediciones: readonly Edicion[], premios: readonly Premio[]): EnNumeros {
  if (ediciones.length === 0) throw new RangeError("enNumeros: no hay ediciones");
  const claves = new Set(premios.flatMap((p) => (p.ganadorClave ? [p.ganadorClave] : [])));
  const sinClave = premios.filter((p) => p.ganadorClave === null).length;
  const anios = ediciones.map((e) => e.anio);
  return {
    ediciones: ediciones.length,
    premios: premios.length,
    geneticas: new Set(premios.flatMap((p) => (p.geneticaClave ? [p.geneticaClave] : []))).size,
    ganadores: claves.size + sinClave,
    marcas: {
      min: Math.min(...ediciones.map((e) => e.marcas.min)),
      max: Math.max(...ediciones.map((e) => e.marcas.max)),
    },
    desde: Math.min(...anios) as Anio,
    hasta: Math.max(...anios) as Anio,
  };
}

export function esCategoria(valor: string): valor is Categoria {
  return (CATEGORIAS as readonly string[]).includes(valor);
}

export function esFamilia(valor: string): valor is Familia {
  return (FAMILIAS as readonly string[]).includes(valor);
}

export type FiltroPremios = {
  anio?: Anio | null;
  /** Una categoría o una familia entera ("extracto" trae rosin, hash y extracciones). */
  categoria?: Categoria | Familia | null;
  /** Texto libre, sin importar tildes ni mayúsculas; todas las palabras tienen que estar. */
  q?: string | null;
};

/** El premio mayor de una edición (categoría `campeon`), o `null` si no hay registro. */
export function campeonDe(premios: readonly Premio[], anio: Anio): Premio | null {
  return premios.find((p) => p.edicion === anio && p.categoria === "campeon") ?? null;
}

/** Lo que llega en la URL del palmarés: Next da `string[]` si un parámetro se repite. */
export type ParamsPalmares = {
  anio?: string | string[];
  categoria?: string | string[];
  q?: string | string[];
};

export type FiltroLeido = { anio: Anio | null; categoria: Categoria | Familia | null; q: string };

/** Largo máximo de la búsqueda libre: lo que sobra se corta. */
export const Q_MAXIMO = 80;

/**
 * El filtro del palmarés a partir de la URL (`?anio=2019&categoria=extracto`).
 * Lo inválido se ignora en vez de romper: un año sin edición, una categoría
 * inventada o un año escrito "2019.0" no filtran. Si un parámetro se repite,
 * vale el primero. `anios` son los años con edición (ANIOS de index.ts).
 */
export function filtroDeParams(params: ParamsPalmares, anios: readonly Anio[]): FiltroLeido {
  const uno = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();
  const anioTxt = uno(params.anio);
  const anio = /^\d{4}$/.test(anioTxt) ? (anios.find((a) => a === Number(anioTxt)) ?? null) : null;
  const catTxt = uno(params.categoria);
  const categoria = esCategoria(catTxt) || esFamilia(catTxt) ? catTxt : null;
  const q = uno(params.q).replace(/\s+/g, " ").slice(0, Q_MAXIMO).trim();
  return { anio, categoria, q };
}

/** El filtro del palmarés. Conserva el orden de entrada. */
export function filtrarPremios(premios: readonly Premio[], filtro: FiltroPremios): Premio[] {
  const { anio, categoria } = filtro;
  const palabras = fold(filtro.q ?? "")
    .split(" ")
    .filter(Boolean);
  return premios.filter((p) => {
    if (anio && p.edicion !== anio) return false;
    if (categoria) {
      if (esFamilia(categoria)) {
        if (FAMILIA_DE[p.categoria] !== categoria) return false;
      } else if (p.categoria !== categoria) {
        return false;
      }
    }
    if (palabras.length > 0) {
      const texto = fold(
        [p.ganador, p.genetica, p.banco, p.categoriaRotulo, p.premioRotulo]
          .filter(Boolean)
          .join(" "),
      );
      if (!palabras.every((w) => texto.includes(w))) return false;
    }
    return true;
  });
}
