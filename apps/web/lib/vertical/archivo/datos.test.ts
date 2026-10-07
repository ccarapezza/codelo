// Invariantes sobre el manifiesto real del archivo histórico (notas.ts, que
// genera el repo de secretaría) y sobre lo que lo rodea: las ilustraciones, los
// rótulos de la interfaz y el filtro de la home.
//
// El riesgo acá no es un crash: es un slug repetido que manda dos URL viejas a
// la misma nota, una fecha que corre de día, un mail o un handle publicado por
// descuido, o una nota del sitio viejo que se cuela en la portada.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ILUSTRACIONES,
  ILUSTRACION_DE_TIPO,
  NOTAS,
  SLUGS_VIEJOS,
  TIPOS_NOTA,
  destinoUrlVieja,
  fechaCorta,
  sinNotasViejas,
  type NotaArchivo,
} from "./index";

// Con el entorno jsdom, import.meta.url no es file://; vitest sí inyecta __dirname.
const AQUI = __dirname;
const WEB = path.resolve(__dirname, "../../..");
const PUBLIC = path.join(WEB, "public");
const MENSAJES = path.join(WEB, "messages/es.vertical.json");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

const viejas = NOTAS.filter(n => n.viejoId !== null);
const nuevas = NOTAS.filter(n => n.viejoId === null);

describe("manifiesto", () => {
  it("es el que genera el script, y trae las notas del sitio viejo", () => {
    const texto = fs.readFileSync(path.join(AQUI, "notas.ts"), "utf8");
    expect(
      texto.startsWith("// GENERADO por salidas/web-vieja/_import/generar_manifiesto.py"),
    ).toBe(true);
    expect(viejas.length).toBeGreaterThan(0);
  });

  it("los slugs son únicos y bien formados", () => {
    expect(new Set(NOTAS.map(n => n.slug)).size).toBe(NOTAS.length);
    for (const n of NOTAS) expect(n.slug, n.slug).toMatch(SLUG);
  });

  it("los tipos son los conocidos", () => {
    for (const n of NOTAS) expect(TIPOS_NOTA, n.slug).toContain(n.tipo);
  });

  it("las fechas van en hora de Argentina; las viejas, entre 2014 y 2021", () => {
    for (const n of NOTAS) {
      expect(n.fecha, n.slug).toMatch(FECHA);
      expect(Number.isNaN(Date.parse(n.fecha)), n.slug).toBe(false);
      expect(fechaCorta(n.fecha), n.slug).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
    for (const n of viejas) {
      const anio = Number(n.fecha.slice(0, 4));
      expect(anio >= 2014 && anio <= 2021, n.slug).toBe(true);
    }
  });

  it("ningún id viejo se repite, contando los fusionados", () => {
    const ids = NOTAS.flatMap(n => (n.viejoId === null ? [] : [n.viejoId, ...n.idsFusionados]));
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of nuevas) expect(n.idsFusionados, n.slug).toEqual([]);
  });

  it("ningún texto lleva @, enlaces ni vacíos", () => {
    for (const n of NOTAS) {
      const textos = [n.titulo, n.excerpt, n.autor, n.portada.alt, n.entrevistado ?? "x"];
      for (const t of textos) {
        expect(t.trim(), n.slug).not.toBe("");
        expect(t, n.slug).not.toMatch(/@/);
        expect(t, n.slug).not.toMatch(/https?:\/\/|www\./i);
      }
    }
  });

  it("destacadas: las entrevistas y las nuevas, y nada más", () => {
    for (const n of NOTAS) {
      expect(n.destacada, n.slug).toBe(n.tipo === "entrevista" || n.viejoId === null);
    }
  });

  it("el entrevistado está escrito en el título o en la bajada; fuera de las entrevistas, no hay", () => {
    for (const n of NOTAS) {
      if (n.tipo !== "entrevista") {
        expect(n.entrevistado, n.slug).toBeNull();
        continue;
      }
      if (n.entrevistado === null) continue;
      expect(n.titulo.includes(n.entrevistado) || n.excerpt.includes(n.entrevistado), n.slug).toBe(
        true,
      );
    }
  });

  it("cada portada es una ilustración de archivo o una imagen del CMS, y las fotos llevan alt", () => {
    const locales = new Set<string>(Object.values(ILUSTRACIONES).map(i => i.src));
    for (const n of NOTAS) {
      const p = n.portada;
      expect(locales.has(p.src) || p.src.startsWith("/cms/uploads/"), n.slug).toBe(true);
      expect(p.width > 0 && p.height > 0, n.slug).toBe(true);
      if (p.clase === "foto") expect(p.src.startsWith("/cms/uploads/"), n.slug).toBe(true);
      if (locales.has(p.src)) {
        expect(p, n.slug).toEqual(ILUSTRACIONES[ILUSTRACION_DE_TIPO[n.tipo]]);
      }
    }
  });

  // En el CMS, la importación nombra cada portada por su clave de medio:
  // archivo_<tipo>_… es la ilustración de un tipo; archivo_<NNNN>_…, la lámina
  // (o la foto) propia de la nota NNNN. Con eso se sabe qué dibujo es cada una
  // sin mirar su texto alternativo, que es justo lo que se quiere vigilar.
  function origen(n: NotaArchivo): "local" | "del tipo" | "propia" | "foto" | "desconocido" {
    const p = n.portada;
    if (p.clase === "foto") return "foto";
    if (Object.values(ILUSTRACIONES).some(i => i.src === p.src)) return "local";
    if (new RegExp(`^/cms/uploads/archivo_${n.tipo}_[0-9a-f]+\\.webp$`).test(p.src)) {
      return "del tipo";
    }
    const numero = n.viejoId === null ? null : String(n.viejoId).padStart(4, "0");
    if (numero && new RegExp(`^/cms/uploads/archivo_${numero}_[0-9a-f]+\\.webp$`).test(p.src)) {
      return "propia";
    }
    return "desconocido";
  }

  it("un alt por nota: la misma imagen lleva siempre el mismo y dos imágenes nunca comparten uno", () => {
    const altDe = new Map<string, string>();
    const srcDe = new Map<string, string>();
    for (const n of NOTAS) {
      const { src, alt } = n.portada;
      expect(alt.length, n.slug).toBeGreaterThan(40);
      expect(altDe.get(src) ?? alt, `${n.slug}: la misma portada con otro alt`).toBe(alt);
      expect(srcDe.get(alt) ?? src, `${n.slug}: otra portada con el mismo alt`).toBe(src);
      altDe.set(src, alt);
      srcDe.set(alt, src);
    }
  });

  it("ninguna lámina propia lleva el alt de su tipo, y la del tipo lleva el suyo", () => {
    const altsDeTipo = new Set(Object.values(ILUSTRACIONES).map(i => i.alt));
    const propias: string[] = [];
    for (const n of NOTAS) {
      const de = origen(n);
      expect(de, `${n.slug}: portada de origen desconocido (${n.portada.src})`).not.toBe(
        "desconocido",
      );
      if (de === "propia" || de === "foto") {
        expect(
          altsDeTipo.has(n.portada.alt),
          `${n.slug}: lleva el alt de una ilustración de tipo`,
        ).toBe(false);
      } else {
        expect(n.portada.alt, n.slug).toBe(ILUSTRACIONES[ILUSTRACION_DE_TIPO[n.tipo]].alt);
      }
      if (de === "propia") propias.push(n.slug);
    }
    // Las láminas propias existen desde el 07/10/2026: si una importación las
    // perdiera todas (de vuelta la del tipo en cada nota), que se note.
    expect(propias.length).toBeGreaterThan(0);
  });
});

/** Ancho y alto de un WebP leídos de su cabecera (VP8, VP8L o VP8X), sin dependencias. */
function medidasWebp(buf: Buffer): { width: number; height: number } {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("no es un WebP");
  }
  const tipo = buf.toString("ascii", 12, 16);
  if (tipo === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (tipo === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (tipo === "VP8X")
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  throw new Error(`WebP desconocido: ${tipo}`);
}

describe("ilustraciones", () => {
  it("cada tipo tiene la suya, y cada archivo existe y mide lo que dice el módulo", () => {
    for (const t of TIPOS_NOTA) expect(ILUSTRACIONES[ILUSTRACION_DE_TIPO[t]], t).toBeDefined();
    for (const [id, i] of Object.entries(ILUSTRACIONES)) {
      expect(i.src, id).toBe(`/archivo/portadas/${id}.webp`);
      const archivo = path.join(PUBLIC, i.src);
      expect(fs.existsSync(archivo), i.src).toBe(true);
      expect(medidasWebp(fs.readFileSync(archivo)), i.src).toEqual({
        width: i.width,
        height: i.height,
      });
      expect(Math.max(i.width, i.height), i.src).toBe(1600);
      expect(i.alt.length, i.src).toBeGreaterThan(40);
      expect(i.alt, i.src).not.toMatch(/@/);
    }
  });
});

describe("la home y las URL viejas", () => {
  it("la portada no muestra ninguna nota del sitio viejo y sí deja pasar las nuevas", () => {
    expect(SLUGS_VIEJOS.size).toBe(viejas.length);
    const posts = [
      { slug: "una-nota-de-hoy" },
      ...NOTAS.map(n => ({ slug: n.slug })),
      { slug: "otra-nota-de-hoy" },
    ];
    expect(sinNotasViejas(posts, SLUGS_VIEJOS).map(p => p.slug)).toEqual([
      "una-nota-de-hoy",
      ...nuevas.map(n => n.slug),
      "otra-nota-de-hoy",
    ]);
  });

  it("cada artículo viejo, y cada uno fusionado, lleva a su nota", () => {
    for (const n of viejas) {
      for (const id of [n.viejoId, ...n.idsFusionados]) {
        expect(destinoUrlVieja(["codeloweb", "article", String(id)], NOTAS), `${id}`).toBe(
          `/blog/${n.slug}`,
        );
      }
    }
  });
});

describe("rótulos de la interfaz", () => {
  type Mensajes = { [clave: string]: string | Mensajes };
  const TODO = JSON.parse(fs.readFileSync(MENSAJES, "utf8")) as Mensajes;
  const ARCHIVO = TODO.archivo as Mensajes;

  function rotulo(...ruta: string[]): string | null {
    let nodo: string | Mensajes | undefined = ARCHIVO;
    for (const k of ruta) nodo = typeof nodo === "object" ? nodo[k] : undefined;
    return typeof nodo === "string" && nodo.trim() !== "" ? nodo : null;
  }

  it("cada tipo tiene su rótulo en singular y en plural, y el pie su enlace", () => {
    const faltan = TIPOS_NOTA.flatMap(t => [
      ...(rotulo("tipo", t) ? [] : [`archivo.tipo.${t}`]),
      ...(rotulo("tipos", t) ? [] : [`archivo.tipos.${t}`]),
    ]);
    expect(faltan).toEqual([]);
    expect((TODO.nav as Mensajes).archivo).toBe("Archivo histórico");
  });

  it("toda clave fija que piden la página y los componentes existe", () => {
    const archivos = [
      path.join(WEB, "app/[lang]/(vertical)/archivo/page.tsx"),
      ...fs
        .readdirSync(path.join(WEB, "components/vertical/archivo"))
        .filter(f => f.endsWith(".tsx"))
        .map(f => path.join(WEB, "components/vertical/archivo", f)),
    ];
    const faltan: string[] = [];
    let usadas = 0;
    for (const archivo of archivos) {
      const texto = fs.readFileSync(archivo, "utf8");
      if (!/getTranslations\(\s*(?:\{[^}]*namespace:\s*)?"archivo"/.test(texto)) continue;
      for (const m of texto.matchAll(/\bt\("([^"]+)"/g)) {
        usadas += 1;
        if (!rotulo(...m[1].split("."))) faltan.push(`${path.basename(archivo)}: archivo.${m[1]}`);
      }
    }
    expect(usadas).toBeGreaterThan(10);
    expect(faltan).toEqual([]);
  });
});

describe("privacidad del código", () => {
  it("los datos no llevan mails, enlaces a Drive ni nombres de documentos internos", () => {
    const archivos = fs.readdirSync(AQUI).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(archivos.length).toBeGreaterThan(4);
    for (const archivo of archivos) {
      const texto = fs.readFileSync(path.join(AQUI, archivo), "utf8");
      expect(texto, archivo).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(texto, archivo).not.toMatch(/(drive|docs|photos|mail)\.google\.com/i);
      expect(texto, archivo).not.toMatch(/\.(pdf|docx?|xlsx?|psd)\b/i);
    }
  });
});
