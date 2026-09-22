// Re-escribe los fixtures de preservación. NO es un test: sin CAPTURE=1 no hace
// nada. Se corre a mano cuando un cambio de texto es DELIBERADO y hay que fijar
// una base nueva, y el diff de los fixtures es lo que se revisa en el PR.
//
//   CAPTURE=1 pnpm exec vitest --run test/preservation/capture.test.ts
//
// Correrlo para "arreglar" un test que falla anula la única prueba de que el
// comportamiento se preserva. Si falla y no era a propósito, el error está en
// el código, no en el fixture.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { SETTINGS_CODELO } from "./settings.codelo";
import { SETTINGS_FULBO } from "./settings.fulbo";
import { construirPrompts } from "./build";

const ACTIVO = process.env.CAPTURE === "1";
const DIR = path.join(__dirname, "fixtures");

async function capturar(proyecto: string, ajustes: Record<string, string>): Promise<number> {
  const base = path.join(DIR, proyecto);
  fs.mkdirSync(base, { recursive: true });
  const prompts = await construirPrompts(ajustes);
  let escritos = 0;
  for (const [nombre, g] of Object.entries(prompts)) {
    fs.writeFileSync(path.join(base, `${nombre}.system.txt`), g.system);
    escritos++;
    if (g.user) {
      fs.writeFileSync(path.join(base, `${nombre}.user.txt`), g.user);
      escritos++;
    }
  }
  return escritos;
}

describe.runIf(ACTIVO)("captura de fixtures de preservación", () => {
  it("codelo", async () => {
    expect(await capturar("codelo", SETTINGS_CODELO)).toBeGreaterThan(20);
  }, 60000);

  it("fulbo", async () => {
    expect(await capturar("fulbo", SETTINGS_FULBO)).toBeGreaterThan(20);
  }, 60000);
});
