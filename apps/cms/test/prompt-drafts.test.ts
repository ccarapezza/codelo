// Los valores neutros y su versión en castellano son dos listas paralelas, y
// dos listas paralelas se desincronizan. Esto lo dice cuando pasa.
//
// El modo de falla real: alguien agrega un campo de instrucción, escribe su
// default en inglés y se olvida del castellano. El campo aparece vacío en «mi
// idioma» y nadie se entera hasta que un usuario lo abre.

import { describe, expect, it } from "vitest";
import { NEUTRAL_PROMPT_SETTINGS } from "../src/lib/prompt-defaults";
import { NEUTRAL_PROMPT_DRAFTS } from "../src/lib/prompt-drafts";
import { ENGINE_PROMPT_CARDS } from "../src/admin/pages/PromptSettingsPage/cards";

/** Los campos de instrucción: los únicos que necesitan versión en castellano. */
const DE_INSTRUCCION = ENGINE_PROMPT_CARDS.flatMap((c) =>
  c.fields.filter((f) => (f.lang ?? "prompt") === "prompt").map((f) => f.key),
);

describe("borradores en castellano", () => {
  it("todo campo de instrucción tiene su versión en castellano", () => {
    const faltan = DE_INSTRUCCION.filter((k) => !NEUTRAL_PROMPT_DRAFTS[k]?.trim());
    expect(faltan, `sin borrador en castellano: ${faltan.join(", ")}`).toEqual([]);
  });

  it("no sobra ningún borrador", () => {
    const sobran = Object.keys(NEUTRAL_PROMPT_DRAFTS).filter((k) => !DE_INSTRUCCION.includes(k));
    expect(sobran, `borradores de campos que no son de instrucción: ${sobran.join(", ")}`).toEqual([]);
  });

  it("conservan la estructura del original", () => {
    // Una traducción que se come las viñetas o los encabezados deja de ser
    // legible como la instrucción que representa.
    for (const k of DE_INSTRUCCION) {
      const en = NEUTRAL_PROMPT_SETTINGS[k] ?? "";
      const es = NEUTRAL_PROMPT_DRAFTS[k] ?? "";
      expect(es.split("\n").length, `${k}: distinta cantidad de líneas`).toBe(
        en.split("\n").length,
      );
      expect(
        es.split("\n").filter((l) => l.trim().startsWith("-")).length,
        `${k}: distinta cantidad de viñetas`,
      ).toBe(en.split("\n").filter((l) => l.trim().startsWith("-")).length);
    }
  });

  it("están en castellano y no son una copia del inglés", () => {
    for (const k of DE_INSTRUCCION) {
      const en = (NEUTRAL_PROMPT_SETTINGS[k] ?? "").trim();
      const es = (NEUTRAL_PROMPT_DRAFTS[k] ?? "").trim();
      // Un campo que quedó sin traducir es exactamente lo que este test busca:
      // pasó de verdad con cuatro campos que seguían en español del otro lado.
      expect(es, `${k}: el borrador es idéntico al texto en inglés`).not.toBe(en);
    }
  });
});
