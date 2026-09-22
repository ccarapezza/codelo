// La prueba de que el refactor no le cambia el comportamiento a nadie.
//
// Arma cada prompt del motor con los ajustes EFECTIVOS de codelo y de fulbo
// —los que corren hoy en producción— y los compara contra el texto congelado en
// `fixtures/`, capturado antes de tocar una palabra.
//
// Cuando un prompt cambie A PROPÓSITO (las reescrituras neutras del plan), se
// re-captura con CAPTURE=1 y el diff de los fixtures es lo que se revisa. Lo que
// NO se hace nunca es re-capturar para que un test deje de molestar.

import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { SETTINGS_CODELO } from "./settings.codelo";
import { SETTINGS_FULBO } from "./settings.fulbo";
import { construirPrompts } from "./build";
import { resolvePromptConstraints, type ArticleAnchors } from "../../src/lib/openai";
import * as I from "./inputs";
import type { Grabado } from "./recorder";

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

describe("lo que los fixtures dejan documentado", () => {
  it("hoy el deduplicador y el traductor le mandan a fulbo el dominio de codelo", () => {
    // Este test NO es una aserción de que esté bien: congela el defecto que el
    // refactor viene a arreglar, para que el día que se arregle falle acá y haya
    // que borrarlo a conciencia. Ver §1 del plan (`domainDescription` pasa a
    // alimentar ambos prompts).
    for (const archivo of ["dedup.system.txt", "translate.system.txt"]) {
      expect(leer("fulbo", archivo)).toBe(leer("codelo", archivo));
      expect(leer("fulbo", archivo)).toMatch(/cannabis/i);
    }
  });

  it("el redactor y el Director llevan ejemplos de dos dominios a la vez", () => {
    // Reglas de fútbol y de autocultivo conviviendo en el mismo bloque.
    const director = leer("codelo", "director.system.txt");
    expect(director).toMatch(/ARICCAME|ANMAT/);
    expect(director).toMatch(/Infobae|Perfil/);
  });
});
