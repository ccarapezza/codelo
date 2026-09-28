// La marca de las placas: qué gana entre la base y el motor, y qué pasa con un
// color mal escrito.
//
// Existe porque los tres modos de fallar son silenciosos: un color inválido que
// rompe el render en mitad de una tanda, un color vacío que se toma como negro,
// y una clave que el panel escribe pero el renderer no lee.

import { describe, expect, it } from "vitest";
import {
  BRAND_COLOR_KEYS,
  NEUTRAL_BRAND_COLORS,
  fireGradient,
  resolveBrand,
  rgba,
  settingKeyForColor,
} from "../src/lib/social-cards/brand";

describe("resolveBrand", () => {
  it("sin fila devuelve los colores del motor", () => {
    expect(resolveBrand(null)).toMatchObject(NEUTRAL_BRAND_COLORS);
  });

  it("la base le gana al motor, color por color", () => {
    const b = resolveBrand({ brandBg: "#F4EFE6", brandAccent: "#C2410C" });
    expect(b.bg).toBe("#F4EFE6");
    expect(b.accent).toBe("#C2410C");
    // Los que no vinieron siguen siendo los del motor, no quedan vacíos.
    expect(b.title).toBe(NEUTRAL_BRAND_COLORS.title);
  });

  it("un color vacío o inválido cae al del motor en vez de romper", () => {
    // Es la diferencia entre una placa con un color de menos y una tanda caída.
    for (const malo of ["", "   ", "rojo", "#FFF", "#GGGGGG", "0E1A1C", null, 42]) {
      expect(resolveBrand({ brandBg: malo }).bg).toBe(NEUTRAL_BRAND_COLORS.bg);
    }
  });

  it("normaliza a mayúsculas y sin espacios", () => {
    expect(resolveBrand({ brandBg: "  #f4efe6  " }).bg).toBe("#F4EFE6");
  });

  it("siempre trae las tipografías", () => {
    const b = resolveBrand(null);
    expect(b.fontDisplay).toBeTruthy();
    expect(b.fontBody).toBeTruthy();
  });
});

describe("settingKeyForColor", () => {
  it("arma la clave del ajuste desde el rol", () => {
    expect(settingKeyForColor("bg")).toBe("brandBg");
    expect(settingKeyForColor("accentLight")).toBe("brandAccentLight");
  });

  it("cubre todos los roles sin colisiones", () => {
    const claves = BRAND_COLOR_KEYS.map(settingKeyForColor);
    expect(new Set(claves).size).toBe(BRAND_COLOR_KEYS.length);
  });
});

describe("rgba", () => {
  it("convierte un hex a rgba con el alfa pedido", () => {
    expect(rgba("#0E1A1C", 0.5)).toBe("rgba(14,26,28,0.5)");
  });

  it("un hex inválido cae al fondo del motor", () => {
    // Un velo es una capa a pantalla completa: si sale "rgba(NaN,...)" la placa
    // entera se dibuja mal, y sin error.
    expect(rgba("qué", 0.5)).toBe("rgba(14,26,28,0.5)");
  });
});

describe("fireGradient", () => {
  it("va del acento claro al profundo, en ese orden", () => {
    const g = fireGradient({ ...NEUTRAL_BRAND_COLORS, accentLight: "#AAA111", accent: "#BBB222", accentDeep: "#CCC333" });
    expect(g.indexOf("#AAA111")).toBeLessThan(g.indexOf("#BBB222"));
    expect(g.indexOf("#BBB222")).toBeLessThan(g.indexOf("#CCC333"));
  });
});

describe("el acento profundo no se usa como texto", () => {
  it("ninguna plantilla lo pone en un `color:`", async () => {
    // `accentDeep` es el cierre del degradé y los velos: va DEBAJO de algo. Las
    // plantillas `stat` y `countdown` lo usaban para su número de 460px —herencia
    // del prototipo, donde el slot era naranja brillante— y con el azul de Nib
    // eso daba 1.97:1 sobre su propio fondo. Un número gigante casi invisible,
    // sin un solo error. Esto es lo que impide que vuelva.
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const f of ["src/lib/social-cards/templates.ts", "src/lib/social-video/overlays.ts"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
      expect(src, `${f} usa accentDeep como color de texto`).not.toMatch(/color:\s*marca\.accentDeep/);
    }
  });
});
