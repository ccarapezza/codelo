import { describe, expect, it } from "vitest";
import {
  evaluarAviso,
  type Lectura,
  parseLugarCookie,
  puntoDeRocio,
  type WmoGrupo,
} from "./weather";

function lectura(over: Partial<Lectura>): Lectura {
  return {
    temperatura: 20,
    sensacion: null,
    humedad: 55,
    vpd: 1.0,
    viento: null,
    grupo: "despejado" as WmoGrupo,
    esDeDia: true,
    observadoEn: "2026-03-15T14:00",
    zona: "America/Argentina/Buenos_Aires",
    ...over,
  };
}

const claveDe = (over: Partial<Lectura>) => evaluarAviso(lectura(over)).clave;

describe("puntoDeRocio", () => {
  it("con aire saturado iguala a la temperatura", () => {
    expect(puntoDeRocio(20, 100)).toBeCloseTo(20, 1);
  });

  it("coincide con los valores de tabla", () => {
    // 20 °C / 50 % HR → ~9,3 °C es el valor psicrométrico conocido.
    expect(puntoDeRocio(20, 50)).toBeCloseTo(9.3, 1);
  });

  it("no explota con humedad 0 (la acota, no divide por cero)", () => {
    expect(Number.isFinite(puntoDeRocio(20, 0))).toBe(true);
  });
});

describe("evaluarAviso · temperatura", () => {
  it("avisa helada bajo cero", () => {
    expect(claveDe({ temperatura: -2 })).toBe("helada");
    expect(claveDe({ temperatura: 0 })).toBe("helada");
  });

  it("avisa riesgo de helada ANTES de llegar a cero", () => {
    // Por enfriamiento radiativo la superficie del cultivo queda 2–4 °C por
    // debajo del abrigo: si el aviso esperara a 0 °C llegaría tarde.
    expect(claveDe({ temperatura: 2.5 })).toBe("riesgoHelada");
    expect(claveDe({ temperatura: 3 })).toBe("riesgoHelada");
    expect(claveDe({ temperatura: 3.1 })).not.toBe("riesgoHelada");
  });

  it("avisa calor extremo", () => {
    expect(claveDe({ temperatura: 39, humedad: 20, vpd: 4.5 })).toBe("calorExtremo");
  });

  it("la helada gana sobre cualquier aviso fúngico", () => {
    expect(claveDe({ temperatura: -1, humedad: 95, vpd: 0.02 })).toBe("helada");
  });
});

describe("evaluarAviso · hongos", () => {
  it("dispara ventana de Botrytis con HR alta en rango térmico", () => {
    expect(claveDe({ temperatura: 18, humedad: 92, vpd: 0.17 })).toBe("botrytisVentana");
  });

  it("NO la dispara fuera del rango térmico de Botrytis", () => {
    expect(claveDe({ temperatura: 5, humedad: 95, vpd: 0.04 })).not.toBe("botrytisVentana");
  });

  it("dispara condensación de noche cuando T se acerca al punto de rocío", () => {
    // 15 °C / 88 % → Td ≈ 13,1 °C, o sea T − Td < 2 °C.
    expect(claveDe({ temperatura: 15, humedad: 88, esDeDia: false, vpd: 0.2 })).toBe(
      "condensacion",
    );
  });

  it("no avisa condensación de día con los mismos números", () => {
    expect(claveDe({ temperatura: 15, humedad: 88, esDeDia: true, vpd: 0.2 })).not.toBe(
      "condensacion",
    );
  });

  it("dispara oídio con humedad alta y follaje seco", () => {
    expect(claveDe({ temperatura: 25, humedad: 72, vpd: 0.9, grupo: "despejado" })).toBe("oidio");
  });

  it("NO dispara oídio si está lloviendo: el agua libre lo perjudica", () => {
    expect(claveDe({ temperatura: 25, humedad: 72, vpd: 0.9, grupo: "lluvia" })).not.toBe("oidio");
  });
});

describe("evaluarAviso · demanda evaporativa", () => {
  it("avisa demanda muy alta", () => {
    expect(claveDe({ temperatura: 35, humedad: 15, vpd: 3.4 })).toBe("demandaMuyAlta");
  });

  it("avisa demanda elevada arriba de 2 kPa", () => {
    expect(claveDe({ temperatura: 32, humedad: 30, vpd: 2.4 })).toBe("demandaAlta");
  });

  it("avisa aire quieto con VPD muy bajo que no cayó en las reglas fúngicas", () => {
    // 8 °C está fuera del rango de Botrytis (10–27), así que llega hasta acá.
    expect(claveDe({ temperatura: 8, humedad: 95, vpd: 0.05 })).toBe("aireQuieto");
  });
});

describe("evaluarAviso · sin alertas", () => {
  it("reconoce condiciones favorables", () => {
    expect(claveDe({ temperatura: 22, humedad: 55, vpd: 1.2 })).toBe("favorable");
  });

  it("cae en neutro cuando no matchea nada", () => {
    expect(claveDe({ temperatura: 12, humedad: 60, vpd: 0.56 })).toBe("neutro");
  });
});

describe("parseLugarCookie", () => {
  it("acepta una cookie bien formada y redondea a 2 decimales", () => {
    expect(parseLugarCookie("-34.612345|-58.443210|Caballito")).toEqual({
      latitude: -34.61,
      longitude: -58.44,
      label: "Caballito",
      isDefault: false,
    });
  });

  it("rechaza coordenadas fuera de rango", () => {
    expect(parseLugarCookie("999|-58.44|X")).toBeNull();
    expect(parseLugarCookie("-34.61|999|X")).toBeNull();
  });

  it("rechaza formatos rotos", () => {
    expect(parseLugarCookie(undefined)).toBeNull();
    expect(parseLugarCookie("solo-una-parte")).toBeNull();
    expect(parseLugarCookie("-34.61|-58.44|")).toBeNull();
  });

  it("limpia caracteres de control y ángulos de la etiqueta", () => {
    expect(parseLugarCookie("-34.61|-58.44|<script>Boedo</script>")?.label).toBe("scriptBoedo/script");
  });

  it("trunca etiquetas largas", () => {
    const larga = "a".repeat(200);
    expect(parseLugarCookie(`-34.61|-58.44|${larga}`)?.label).toHaveLength(48);
  });
});
