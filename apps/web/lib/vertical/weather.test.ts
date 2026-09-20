import { describe, expect, it } from "vitest";
import {
  balanceHidrico,
  bandaDli,
  type Dia,
  dliDesdeRadiacion,
  evaluarAviso,
  evaluarAvisosPronostico,
  fraccionDeSol,
  type Horario,
  horasDeLuz,
  type Lectura,
  mapPronostico,
  parseLugarCookie,
  puntoDeRocio,
  recortarDesdeAhora,
  tendenciaFotoperiodo,
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
    // Solo llegan con el set extendido; con el de la home quedan en null.
    rocio: null,
    uv: null,
    nubosidad: null,
    presion: null,
    rafaga: null,
    vientoDir: null,
    precipitacion: null,
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

/* -------------------------------------------------------------------------- */
/* Pronóstico                                                                  */
/* -------------------------------------------------------------------------- */

function dia(over: Partial<Dia> = {}): Dia {
  return {
    fecha: "2026-07-22",
    maxima: 20,
    minima: 10,
    grupo: "despejado" as WmoGrupo,
    amanece: "2026-07-22T07:54",
    atardece: "2026-07-22T18:06",
    luzHoras: 10.2,
    solHoras: 6,
    uvMax: 3,
    lluviaMm: 0,
    probLluvia: 0,
    rafagaMax: 20,
    radiacionMJ: 10,
    et0: 1.2,
    ...over,
  };
}

function hora(over: Partial<Horario> = {}): Horario {
  return {
    hora: "2026-07-22T12:00",
    temperatura: 18,
    humedad: 60,
    vpd: 0.8,
    rocio: 10,
    probLluvia: 0,
    viento: 10,
    uv: 2,
    sueloTemp: 14,
    sueloHumedad: 0.3,
    grupo: "despejado" as WmoGrupo,
    esDeDia: true,
    ...over,
  };
}

describe("mapPronostico", () => {
  it("parsea arrays paralelos y convierte los segundos de luz a horas", () => {
    const p = mapPronostico({
      hourly: {
        time: ["2026-07-22T00:00", "2026-07-22T01:00"],
        temperature_2m: [8.3, 8.1],
        relative_humidity_2m: [93, 94],
        vapour_pressure_deficit: [0.08, 0.07],
      },
      daily: {
        time: ["2026-07-22"],
        temperature_2m_max: [13.7],
        temperature_2m_min: [8],
        daylight_duration: [36674.3],
      },
    });
    expect(p?.horas).toHaveLength(2);
    expect(p?.dias[0].luzHoras).toBeCloseTo(10.19, 2);
  });

  it("conserva el punto cuando falta una magnitud secundaria, como hueco", () => {
    // Descartar la hora entera por un DPV faltante cortaría también la serie de
    // temperatura, que sí llegó.
    const p = mapPronostico({
      hourly: {
        time: ["2026-07-22T00:00"],
        temperature_2m: [8.3],
        vapour_pressure_deficit: [null],
      },
    });
    expect(p?.horas).toHaveLength(1);
    expect(p?.horas[0].vpd).toBeNull();
    expect(p?.horas[0].temperatura).toBe(8.3);
  });

  it("descarta el punto si falta la hora o su magnitud principal", () => {
    const p = mapPronostico({
      hourly: {
        time: ["2026-07-22T00:00", null, "2026-07-22T02:00"],
        temperature_2m: [8.3, 8.1, null],
      },
    });
    expect(p?.horas).toHaveLength(1);
  });

  it("no inventa filas si las columnas vienen de largos distintos", () => {
    const p = mapPronostico({
      hourly: {
        time: ["2026-07-22T00:00", "2026-07-22T01:00", "2026-07-22T02:00"],
        temperature_2m: [8.3],
      },
    });
    expect(p?.horas).toHaveLength(1);
  });

  it("devuelve null solo si no quedó ningún punto usable", () => {
    expect(mapPronostico({})).toBeNull();
    expect(mapPronostico({ hourly: { time: [] } })).toBeNull();
  });

  it("un bloque roto no invalida al otro", () => {
    const p = mapPronostico({
      hourly: { time: [null], temperature_2m: [null] },
      daily: { time: ["2026-07-22"], temperature_2m_max: [13.7], temperature_2m_min: [8] },
    });
    expect(p?.horas).toHaveLength(0);
    expect(p?.dias).toHaveLength(1);
  });
});

describe("recortarDesdeAhora", () => {
  // El bloque `hourly` arranca a las 00:00 de hoy: sin recorte, a las 23:00
  // casi toda la serie sería pasado.
  const dia1 = Array.from({ length: 24 }, (_, i) =>
    hora({ hora: `2026-07-22T${String(i).padStart(2, "0")}:00` }),
  );
  const dia2 = Array.from({ length: 24 }, (_, i) =>
    hora({ hora: `2026-07-23T${String(i).padStart(2, "0")}:00` }),
  );
  const serie = [...dia1, ...dia2];

  it("arranca en la hora en curso, no a la medianoche", () => {
    const r = recortarDesdeAhora(serie, "2026-07-22T12:45");
    expect(r[0].hora).toBe("2026-07-22T12:00");
  });

  it("a las 23:00 sigue devolviendo horas futuras y no se queda corto de golpe", () => {
    const r = recortarDesdeAhora(serie, "2026-07-22T23:10");
    expect(r[0].hora).toBe("2026-07-22T23:00");
    expect(r.length).toBeGreaterThan(20);
  });

  it("sin cursor devuelve las primeras n sin tocar", () => {
    expect(recortarDesdeAhora(serie, null, 5)).toHaveLength(5);
    expect(recortarDesdeAhora(serie, null, 5)[0].hora).toBe("2026-07-22T00:00");
  });

  it("con un cursor posterior a toda la serie degrada en vez de vaciar", () => {
    expect(recortarDesdeAhora(serie, "2027-01-01T00:00", 3)).toHaveLength(3);
  });
});

describe("derivaciones de luz", () => {
  it("convierte segundos a horas", () => {
    expect(horasDeLuz(43200)).toBe(12);
  });

  it("aplica el factor documentado de radiación a DLI", () => {
    // Fijado a propósito: si alguien toca el factor, este test lo dice.
    expect(dliDesdeRadiacion(1)).toBeCloseTo(2.06, 2);
    expect(dliDesdeRadiacion(0)).toBe(0);
  });

  it("da valores del orden correcto contra días reales de Buenos Aires", () => {
    // Verano despejado ~30 MJ, invierno cerrado ~6,5 MJ (archivo de Open-Meteo).
    expect(dliDesdeRadiacion(30.5)).toBeGreaterThan(50);
    expect(dliDesdeRadiacion(30.5)).toBeLessThan(70);
    expect(dliDesdeRadiacion(6.52)).toBeLessThan(20);
  });

  it("clasifica el día en bandas descriptivas", () => {
    expect(bandaDli(8)).toBe("baja");
    expect(bandaDli(15)).toBe("media");
    expect(bandaDli(25)).toBe("alta");
    expect(bandaDli(60)).toBe("muyAlta");
  });

  it("acota la fracción de sol a 1 aunque el modelo se pase", () => {
    expect(fraccionDeSol(dia({ luzHoras: 10, solHoras: 11 }))).toBe(1);
    expect(fraccionDeSol(dia({ luzHoras: 10, solHoras: 5 }))).toBe(0.5);
    expect(fraccionDeSol(dia({ luzHoras: 0, solHoras: 0 }))).toBeNull();
    expect(fraccionDeSol(dia({ solHoras: null }))).toBeNull();
  });
});

describe("tendenciaFotoperiodo", () => {
  it("detecta el día acortándose y su ritmo en minutos", () => {
    const r = tendenciaFotoperiodo([dia({ luzHoras: 12 }), dia({ luzHoras: 11.9 })]);
    expect(r?.sentido).toBe("acorta");
    expect(r?.minutosPorDia).toBeCloseTo(-6, 1);
  });

  it("detecta el día alargándose", () => {
    expect(tendenciaFotoperiodo([dia({ luzHoras: 10 }), dia({ luzHoras: 10.2 })])?.sentido).toBe(
      "alarga",
    );
  });

  it("no llama tendencia al ruido del solsticio", () => {
    expect(tendenciaFotoperiodo([dia({ luzHoras: 14.48 }), dia({ luzHoras: 14.481 })])?.sentido).toBe(
      "estable",
    );
  });

  it("devuelve null sin datos suficientes", () => {
    expect(tendenciaFotoperiodo([])).toBeNull();
    expect(tendenciaFotoperiodo([dia()])).toBeNull();
    expect(tendenciaFotoperiodo([dia({ luzHoras: null }), dia({ luzHoras: null })])).toBeNull();
  });
});

describe("balanceHidrico", () => {
  it("resta la lluvia a la demanda atmosférica", () => {
    expect(balanceHidrico(3, 1)).toBe(2);
    expect(balanceHidrico(3, 5)).toBe(-2);
  });

  it("trata la lluvia ausente como cero pero la demanda ausente como desconocida", () => {
    expect(balanceHidrico(3, null)).toBe(3);
    expect(balanceHidrico(null, 5)).toBeNull();
  });
});

describe("evaluarAvisosPronostico", () => {
  const sinNada = { horas: [hora()], dias: [dia()] };

  it("avisa de helada con el día al que se refiere", () => {
    const a = evaluarAvisosPronostico({ horas: [], dias: [dia({ minima: 2, fecha: "2026-08-01" })] });
    expect(a[0]).toMatchObject({ clave: "heladaProxima", cuando: "2026-08-01" });
  });

  it("escala a alerta cuando la mínima perfora el cero", () => {
    const templada = evaluarAvisosPronostico({ horas: [], dias: [dia({ minima: 2 })] });
    const bajoCero = evaluarAvisosPronostico({ horas: [], dias: [dia({ minima: -1 })] });
    expect(templada[0].severidad).toBe("atencion");
    expect(bajoCero[0].severidad).toBe("alerta");
  });

  it("pide dos días seguidos de calor, no uno solo", () => {
    const unDia = evaluarAvisosPronostico({ horas: [], dias: [dia({ maxima: 36 }), dia()] });
    const dosDias = evaluarAvisosPronostico({
      horas: [],
      dias: [dia({ maxima: 36 }), dia({ maxima: 37 })],
    });
    expect(unDia.some(a => a.clave === "olaDeCalor")).toBe(false);
    expect(dosDias.some(a => a.clave === "olaDeCalor")).toBe(true);
  });

  it("detecta la ventana de mojado solo con 8 horas seguidas", () => {
    const corta = Array.from({ length: 7 }, () => hora({ humedad: 95 }));
    const larga = Array.from({ length: 8 }, () => hora({ humedad: 95 }));
    expect(
      evaluarAvisosPronostico({ horas: corta, dias: [] }).some(a => a.clave === "mojadoProlongado"),
    ).toBe(false);
    expect(
      evaluarAvisosPronostico({ horas: larga, dias: [] }).some(a => a.clave === "mojadoProlongado"),
    ).toBe(true);
  });

  it("no cuenta como racha las horas húmedas salteadas", () => {
    const salteadas = Array.from({ length: 20 }, (_, i) => hora({ humedad: i % 2 ? 95 : 40 }));
    expect(
      evaluarAvisosPronostico({ horas: salteadas, dias: [] }).some(
        a => a.clave === "mojadoProlongado",
      ),
    ).toBe(false);
  });

  it("ordena por severidad y no devuelve más de cuatro", () => {
    const a = evaluarAvisosPronostico({
      horas: Array.from({ length: 10 }, () => hora({ humedad: 95 })),
      dias: [
        dia({ minima: -2 }),
        dia({ maxima: 36 }),
        dia({ maxima: 36 }),
        dia({ lluviaMm: 30 }),
        dia({ rafagaMax: 80 }),
        dia({ uvMax: 10 }),
      ],
    });
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a[0].severidad).toBe("alerta");
  });

  it("con todo en calma informa la ventana en vez de callarse", () => {
    const a = evaluarAvisosPronostico(sinNada);
    expect(a).toHaveLength(1);
    expect(a[0].severidad).toBe("info");
    expect(["ventanaSinLluvia", "sinNovedades"]).toContain(a[0].clave);
  });
});
