// El contrato de los ajustes: schema ↔ claves del motor ↔ defaults.
//
// Los tres tienen que decir lo mismo. Cuando se desincronizaron, el panel quedó
// mintiendo en las dos direcciones a la vez y sin un solo error en el log:
//   · `brandName` estaba en el schema pero no en la allowlist → la pantalla
//     nunca lo ofrecía y el nombre de la marca no se podía cambiar.
//   · `boletinAnalysisInstructions` estaba en la allowlist y en la pantalla pero
//     no en el schema → se escribía, decía "guardado" y Strapi lo descartaba.
// Esto es lo que hace que eso no pueda volver a pasar en silencio.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { ENGINE_PROMPT_KEYS, NEUTRAL_PROMPT_SETTINGS } from "../src/lib/prompt-defaults";
import { ENGINE_SETTING_KEYS } from "../src/lib/setting-keys";
import { verticalPromptKeys } from "../src/verticals/prompt-fields";
import { verticalSettingKeys } from "../src/verticals/setting-fields";

const atributosDe = (tipo: string): string[] =>
  Object.keys(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../src/api/${tipo}/content-types/${tipo}/schema.json`),
        "utf8",
      ),
    ).attributes,
  );

describe("prompt-setting", () => {
  /**
   * `sourceDrafts` está en el schema pero NO es un campo de prompt: es donde se
   * guarda lo que el usuario escribió en su idioma antes de traducirlo. No se
   * manda a ningún modelo, no tiene default y no aparece en la allowlist de
   * campos — se guarda por su propia rama en el controller.
   */
  const NO_ES_PROMPT = new Set(["sourceDrafts"]);
  const schema = atributosDe("prompt-setting").filter((k) => !NO_ES_PROMPT.has(k));

  it("el schema tiene exactamente las claves del motor más las del vertical", () => {
    expect([...schema].sort()).toEqual([...ENGINE_PROMPT_KEYS, ...verticalPromptKeys].sort());
  });

  it("todo campo del motor tiene un valor neutro, y no sobra ninguno", () => {
    // Un campo sin default deja el <Textarea> sin controlar y "Restaurar" lo
    // vuelve `undefined`; uno que sobra es un default que nadie lee.
    expect(Object.keys(NEUTRAL_PROMPT_SETTINGS).sort()).toEqual([...ENGINE_PROMPT_KEYS].sort());
  });

  it("ningún valor neutro queda vacío salvo los que se omiten a propósito", () => {
    // `socialHandle` y `socialHashtags` vacíos son válidos: una instancia sin
    // redes no imprime handle ni hashtags. El resto vacío sería un prompt a
    // medias sin que nadie avise.
    const opcionales = new Set(["socialHandle", "socialHashtags"]);
    for (const [k, v] of Object.entries(NEUTRAL_PROMPT_SETTINGS)) {
      if (opcionales.has(k)) continue;
      expect(v.trim(), `el default neutro de "${k}" está vacío`).not.toBe("");
    }
  });

  it("los valores neutros no nombran ningún tema", () => {
    const todo = Object.values(NEUTRAL_PROMPT_SETTINGS).join("\n").toLowerCase();
    expect(todo).not.toMatch(
      /cannabis|cáñamo|canamo|reprocann|ariccame|boletín|futbol|fútbol|jugador|equipo/,
    );
  });
});

describe("site-setting", () => {
  it("el schema tiene exactamente las claves del motor más las del vertical", () => {
    expect(atributosDe("site-setting").sort()).toEqual(
      [...ENGINE_SETTING_KEYS, ...verticalSettingKeys].sort(),
    );
  });
});
