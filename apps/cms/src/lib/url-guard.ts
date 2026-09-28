// Qué direcciones tiene permitido pedir el motor.
//
// Los feeds no siempre los tipea una persona. El autodiscovery los lee del
// `<link rel="alternate">` de un sitio ajeno, así que la URL que termina
// pidiendo el CMS la eligió un tercero. Medido el 24/09/2026 sobre medios
// reales: iprofesional.com declara su feed en `https://10.109.0.2/rss/home`,
// una IP privada de su propia red interna. Sin esta guarda el CMS sale a
// pedirla — y con una URL elegida a propósito, a pedir el metadata de la nube
// (169.254.169.254) o su propio panel en localhost.
//
// El chequeo es por HOST, antes de resolver DNS: no alcanza contra un dominio
// que resuelve a una IP privada (rebind), pero tapa el caso real —una URL con
// la IP escrita— sin meter un resolver en el medio.

/** Rangos que nunca son una fuente de noticias legítima. */
function esIpPrivada(host: string): boolean {
  // IPv4 en cuatro octetos
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (![a, b, Number(v4[3]), Number(v4[4])].every((n) => n >= 0 && n <= 255)) return true;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local: el metadata de AWS/GCP
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast y reservados
    return false;
  }
  // IPv6, tal como viene entre corchetes en una URL
  const v6 = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true; // unique-local
  if (/^fe80:/.test(v6)) return true; // link-local
  // IPv4 mapeada. Node la normaliza a hexadecimal —`::ffff:127.0.0.1` sale como
  // `::ffff:7f00:1`— así que hay que cubrir las dos formas o la guarda se pasa
  // de largo justo con el loopback.
  const mapeada = v6.match(/^::ffff:(.+)$/);
  if (mapeada) {
    const resto = mapeada[1];
    if (resto.includes(".")) return esIpPrivada(resto);
    const grupos = resto.split(":");
    if (grupos.length === 2) {
      const n = (parseInt(grupos[0], 16) << 16) | parseInt(grupos[1], 16);
      if (Number.isFinite(n)) {
        const octetos = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
        return esIpPrivada(octetos.join("."));
      }
    }
    return true; // forma rara de una mapeada: no la dejamos pasar
  }
  return false;
}

const NOMBRES_LOCALES = new Set(["localhost", "localhost.localdomain", "ip6-localhost"]);

/**
 * `true` si el motor puede salir a pedir esta URL.
 *
 * Exportada para poder testearla sin red.
 */
export function esUrlPublica(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  // Sólo HTTP(S): `file:` leería el disco del container y `gopher:`/`ftp:`
  // son vectores clásicos para hablar con servicios internos.
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();
  if (!host) return false;
  if (NOMBRES_LOCALES.has(host)) return false;
  // `.local` y `.internal` son nombres de red interna por convención.
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return false;
  }
  // Un host sin punto es un nombre de máquina de la red interna ("postgres",
  // "cms"), que es exactamente como se llaman los servicios en docker-compose.
  if (!host.includes(".") && !host.includes(":")) return false;
  if (esIpPrivada(host)) return false;

  return true;
}

/** El motivo, para loguear por qué se descartó una URL. */
export function motivoDescarte(url: string): string {
  return `URL no permitida (host interno, privado o esquema no HTTP): ${url.slice(0, 120)}`;
}
