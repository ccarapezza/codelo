// La prueba de que el refactor no le cambia el comportamiento a nadie.
//
// Arma cada prompt del motor con los ajustes EFECTIVOS de codelo y de fulbo
// —los que corren hoy en producción— y los compara contra el texto congelado en
// `fixtures/`, capturado antes de tocar una palabra.
//
// Cuando un prompt cambie A PROPÓSITO (las reescrituras neutras del plan), se
// re-captura con CAPTURE=1 y el diff de los fixtures es lo que se revisa. Lo que
// NO se hace nunca es re-capturar para que un test deje de molestar.

import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { SETTINGS_CODELO } from "./settings.codelo";
import { SETTINGS_FULBO } from "./settings.fulbo";
import { construirPrompts } from "./build";
import { resolvePromptConstraints, type ArticleAnchors } from "../../src/lib/openai";
import { NEUTRAL_PROMPT_SETTINGS } from "../../src/lib/prompt-defaults";
import * as I from "./inputs";
import type { Grabado } from "./recorder";

// Lo que se congela es el MOTOR con los ajustes de cada proyecto. Las costuras
// de código (pools de portada, enriquecedores de anclas) se aíslan: en el repo
// de un proyecto traen lo suyo, y como son globales al proceso cambiarían los
// prompts de TODOS los proyectos a la vez —en fulbo, sus pools y sus camisetas
// reescribían también los fixtures de codelo—.
vi.mock("../../src/verticals/cover-pools", () => ({ verticalCoverPools: {} }));
vi.mock("../../src/verticals/anchor-enrichers", () => ({ anchorEnrichers: [] }));

const SIN_ANCLAS: ArticleAnchors = {
  topic: null,
  palette: null,
  eventType: null,
  venue: null,
  season: null,
};

const DIR = path.join(__dirname, "fixtures");

const leer = (proyecto: string, archivo: string): string =>
  fs.readFileSync(path.join(DIR, proyecto, archivo), "utf8");

for (const [proyecto, ajustes] of [
  ["codelo", SETTINGS_CODELO],
  ["fulbo", SETTINGS_FULBO],
] as const) {
  describe(`prompts con los ajustes de ${proyecto}`, () => {
    let prompts: Record<string, Grabado>;

    beforeAll(async () => {
      prompts = await construirPrompts(ajustes);
    }, 60000);

    it("captura todos los prompts que tienen fixture", () => {
      const conFixture = new Set(
        fs.readdirSync(path.join(DIR, proyecto)).map((f) => f.replace(/\.(system|user)\.txt$/, "")),
      );
      // Si alguien agrega un prompt y no lo captura, o borra uno y deja el
      // fixture colgado, esto lo dice antes que cualquier comparación de texto.
      expect(new Set(Object.keys(prompts))).toEqual(conFixture);
    });

    // Un test por prompt: cuando algo cambia, el nombre del test dice cuál,
    // en vez de un único test gigante que falla sin decir dónde.
    for (const archivo of fs.readdirSync(path.join(DIR, "codelo")).sort()) {
      const m = archivo.match(/^(.+)\.(system|user)\.txt$/);
      if (!m) continue;
      const [, nombre, parte] = m;
      it(`${nombre} · ${parte}`, () => {
        expect(prompts[nombre][parte as "system" | "user"]).toBe(leer(proyecto, archivo));
      });
    }
  });
}

describe("las semillas siguen cubriendo los dos caminos de portada", () => {
  // Si alguien toca el pool de TREATMENTS, las semillas fijadas pueden caer las
  // dos del mismo lado y los fixtures pasarían a comparar dos veces lo mismo,
  // en silencio. Esto lo dice de frente.
  it("una cae en fotografía y la otra en ilustración", () => {
    const de = (seed: string) => resolvePromptConstraints(seed, SIN_ANCLAS).treatment.kind;
    expect(de(I.SEED_PHOTO)).toBe("photo");
    expect(de(I.SEED_ART)).not.toBe("photo");
  });
});

describe("cada proyecto habla de lo suyo", () => {
  // Hasta este cambio, el deduplicador y el traductor no recibían ajustes y
  // llevaban el dominio escrito adentro: fulbo corría en producción, palabra por
  // palabra, el prompt de cannabis de codelo — y el traductor es→en es el que
  // más usa, porque es el sitio bilingüe. Esto es lo que lo cierra.
  const DE_OTRO_DOMINIO = /cannabis|cáñamo|reprocann|ariccame|etnobotan|ethnobotany/i;

  it("el deduplicador y el traductor ya no son iguales entre proyectos", () => {
    for (const archivo of ["dedup.system.txt", "translate.system.txt"]) {
      expect(leer("fulbo", archivo)).not.toBe(leer("codelo", archivo));
    }
  });

  it("los prompts de fulbo no hablan del dominio de codelo", () => {
    for (const archivo of fs.readdirSync(path.join(DIR, "fulbo"))) {
      expect(leer("fulbo", archivo), `${archivo} arrastra dominio ajeno`).not.toMatch(
        DE_OTRO_DOMINIO,
      );
    }
  });

  it("el Director ya no da por oficiales los organismos de otro dominio", () => {
    const director = leer("fulbo", "director.system.txt");
    expect(director).not.toMatch(/ARICCAME|ANMAT/);
    expect(director).toMatch(/AFA, CONMEBOL, FIFA/);
    // Y tampoco nombra medios reales como ejemplo.
    expect(leer("codelo", "director.system.txt")).not.toMatch(/Infobae|Perfil/);
  });
});

describe("con los valores neutros, el motor no habla de ningún tema", () => {
  // La contracara del test de preservación: aquello se asegura de que un
  // proyecto no pierda su voz; esto, de que el motor no traiga una puesta.
  // Es lo que hace que una instancia nueva arranque sobre un tema en blanco.
  const DOMINIO = new RegExp(
    [
      "cannabis", "cáñamo", "canamo", "reprocann", "ariccame", "anmat", "boletín",
      "botanical", "ethnobotany", "self-cultivation", "asociación civil", "non-profit",
      "futbol", "fútbol", "player", "jersey", "soccer", "conmebol",
      "infobae", "perfil", "rioplatense", "amber", "codelo", "cogollos", "fulbo",
    ].join("|"),
    "i",
  );

  it("ningún prompt nombra un tema, una marca ni un medio", async () => {
    const prompts = await construirPrompts(NEUTRAL_PROMPT_SETTINGS);
    for (const [nombre, g] of Object.entries(prompts)) {
      for (const parte of ["system", "user"] as const) {
        const m = g[parte].match(DOMINIO);
        expect(m?.[0], `${nombre}.${parte} nombra "${m?.[0]}"`).toBeUndefined();
      }
    }
  }, 60000);
});
