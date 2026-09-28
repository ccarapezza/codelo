// La semilla de codelo tiene que cargar EXACTAMENTE lo que el proyecto corría
// en producción antes de adoptar Nib: esos valores están congelados en
// test/preservation/settings.codelo.ts, contra los que se miden los prompts.
// Si esto diverge, el merge le cambia la voz al sitio sin que nada lo avise.

import { describe, expect, it } from "vitest";
import { seeds } from "../src/verticals/seed";
import { SETTINGS_CODELO } from "./preservation/settings.codelo";
import { ENGINE_PROMPT_KEYS } from "../src/lib/prompt-defaults";
import { verticalPromptKeys } from "../src/verticals/prompt-fields";
import { ENGINE_SETTING_KEYS } from "../src/lib/setting-keys";
import { verticalSettingKeys } from "../src/verticals/setting-fields";

describe("semilla de codelo", () => {
  const union = Object.assign({}, ...seeds.map((s) => s.promptSettings ?? {}));

  it("los ajustes editoriales son los de producción, byte a byte", () => {
    expect(union).toEqual(SETTINGS_CODELO);
  });

  it("siembra todos los campos editoriales que existen, y sólo esos", () => {
    expect(Object.keys(union).sort()).toEqual([...ENGINE_PROMPT_KEYS, ...verticalPromptKeys].sort());
  });

  it("los ajustes del sitio existen en el schema y los colores son hex de seis dígitos", () => {
    const validas = new Set<string>([...ENGINE_SETTING_KEYS, ...verticalSettingKeys]);
    for (const s of seeds) {
      for (const [k, v] of Object.entries(s.siteSettings ?? {})) {
        expect(validas.has(k), `${k} no es un ajuste del sitio`).toBe(true);
        if (k.startsWith("brand")) expect(v).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it("las claves de semilla no se repiten: una aplicada no vuelve a correr", () => {
    const claves = seeds.map((s) => s.key);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
