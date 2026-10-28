// Pedidos HTTP por un proxy de salida, sin dependencias: túnel HTTP CONNECT o
// SOCKS5.
//
// Existe por el Boletín Oficial: desde el 22-oct-2026 boletinoficial.gob.ar
// descarta las conexiones que no vienen de una IP argentina. Se probó desde 40
// nodos en 25 países —São Paulo y la red de Cloudflare incluidos— y todos dan
// timeout de conexión; desde una IP residencial argentina responde en 0,2 s. El
// VPS está en EE.UU., así que la salida por Argentina se configura con la URL de
// un proxy.
//
// SOCKS5 es el que habla `ssh -R puerto` sin destino: las PCs de la casa abren
// un túnel SSH inverso hacia el VPS y OpenSSH hace de proxy, restringido al
// Boletín con PermitRemoteOpen (ver deploy/boletin-tunnel/). HTTP CONNECT queda
// para un proxy comercial o un tinyproxy.
//
// Por qué no el `fetch` global: para mandarlo por un proxy hace falta un
// dispatcher de `undici` como dependencia, y el package.json es del motor. Y
// NODE_USE_ENV_PROXY mandaría por el proxy TODO el tráfico del CMS, OpenAI
// incluido, cuando sólo hace falta para un sitio.

import http from "node:http";
import https from "node:https";
import net, { type Socket } from "node:net";
import tls from "node:tls";

export type ProxyResponse = { status: number; ok: boolean; text: string };

export type ProxyRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Tope para TODO el pedido: conectar al proxy, abrir el túnel y leer la respuesta. */
  timeoutMs: number;
};

/**
 * Cómo se nombra un proxy en logs y en el panel: el fragmento de la URL si lo
 * tiene (`socks5h://host:18881#nitro` → "nitro"), si no `host:puerto`. Nunca
 * las credenciales.
 */
export function proxyLabel(proxyUrl: string): string {
  try {
    const u = new URL(proxyUrl);
    return u.hash.length > 1 ? decodeURIComponent(u.hash.slice(1)) : u.host;
  } catch {
    return "proxy inválido";
  }
}

function esSocks(proxy: URL): boolean {
  return proxy.protocol === "socks5:" || proxy.protocol === "socks5h:";
}

/**
 * Hace un pedido a `url` a través del proxy `proxyUrl`:
 * - `socks5://host:puerto` (o `socks5h://`, es lo mismo: el nombre del destino
 *   se resuelve SIEMPRE del lado del proxy, que es donde está la IP argentina);
 * - `http://usuario:clave@host:puerto` (o `https://` si el proxy habla TLS).
 *
 * El TLS con el destino se negocia DENTRO del túnel, de punta a punta: el proxy
 * ve a qué host y puerto se conecta, no el contenido. No sigue redirecciones —
 * el Boletín no las usa—: un 3xx vuelve con `ok: false`.
 */
export function fetchViaProxy(
  url: string,
  proxyUrl: string,
  init: ProxyRequestInit,
): Promise<ProxyResponse> {
  const target = new URL(url);
  const proxy = new URL(proxyUrl);
  const targetTls = target.protocol === "https:";
  const targetPort = Number(target.port) || (targetTls ? 443 : 80);

  return new Promise((resolve, reject) => {
    const sockets: Socket[] = [];
    const track = <S extends Socket>(s: S): S => {
      sockets.push(s);
      // Un 'error' sin listener tumba el proceso —el CMS entero—. Los errores
      // que importan llegan por el pedido HTTP o los corta el timeout.
      s.on("error", () => {});
      return s;
    };
    let settled = false;

    const finish = (err: Error | null, res?: ProxyResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const s of sockets) s.destroy();
      if (err) reject(err);
      else resolve(res!);
    };
    const timer = setTimeout(
      () => finish(new Error(`timeout de ${init.timeoutMs} ms vía proxy`)),
      init.timeoutMs,
    );

    const abrir = esSocks(proxy) ? abrirSocks5 : abrirConnect;
    abrir(proxy, target.hostname, targetPort, track)
      .then((socket) => {
        if (settled) return;
        const tunnel = targetTls
          ? track(tls.connect({ socket, servername: target.hostname }))
          : socket;

        const req = (targetTls ? https : http).request(target, {
          method: init.method ?? "GET",
          // Sin agente, Node no sabe cuál es el puerto por defecto y armaría el
          // Host como "host:80". Se lo da explícito.
          defaultPort: targetTls ? 443 : 80,
          headers: { Host: target.host, ...init.headers },
          createConnection: () => tunnel,
        });
        req.on("error", (err) => finish(err));
        req.on("response", (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("error", (err) => finish(err));
          r.on("end", () => {
            const status = r.statusCode ?? 0;
            finish(null, {
              status,
              ok: status >= 200 && status < 300,
              text: Buffer.concat(chunks).toString("utf8"),
            });
          });
        });
        req.end(init.body);
      })
      .catch((err: Error) => finish(err));
  });
}

// ---------------------------------------------------------------------------
// Apertura del túnel. Los mensajes nombran el tramo que falló —el proxy o el
// destino—, que es lo primero que hay que saber cuando esto se rompe.
// ---------------------------------------------------------------------------

type Abrir = (
  proxy: URL,
  host: string,
  port: number,
  track: <S extends Socket>(s: S) => S,
) => Promise<Socket>;

const abrirConnect: Abrir = (proxy, host, port, track) =>
  new Promise((resolve, reject) => {
    const proxyTls = proxy.protocol === "https:";
    const authority = `${host}:${port}`;
    const headers: Record<string, string> = { Host: authority };
    if (proxy.username) {
      const cred = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
      headers["Proxy-Authorization"] = `Basic ${Buffer.from(cred).toString("base64")}`;
    }
    const req = (proxyTls ? https : http).request({
      host: proxy.hostname,
      port: Number(proxy.port) || (proxyTls ? 443 : 80),
      method: "CONNECT",
      path: authority,
      headers,
    });
    req.on("socket", (s) => track(s));
    req.on("error", (err) => reject(new Error(`proxy inaccesible: ${err.message}`)));
    req.on("connect", (res, socket, head) => {
      // Node emite "connect" con cualquier respuesta al CONNECT, también 407.
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`el proxy rechazó el túnel: HTTP ${res.statusCode}`));
        return;
      }
      if (head.length > 0) socket.unshift(head);
      resolve(socket);
    });
    req.end();
  });

/** Respuestas de error de SOCKS5 (RFC 1928 §6). */
const SOCKS_ERRORES: Record<number, string> = {
  1: "falla general",
  2: "destino no permitido",
  3: "red inalcanzable",
  4: "host inalcanzable",
  5: "conexión rechazada",
  6: "TTL vencido",
  7: "comando no soportado",
  8: "tipo de dirección no soportado",
};

/**
 * SOCKS5 sin autenticación, pidiendo el destino POR NOMBRE (ATYP 3): la
 * resolución DNS la hace el proxy. OpenSSH no autentica el SOCKS de un `-R`
 * dinámico; lo protege que el puerto sólo escuche donde el VPS lo deja.
 */
const abrirSocks5: Abrir = (proxy, host, port, track) =>
  new Promise((resolve, reject) => {
    const socket = track(net.connect(Number(proxy.port) || 1080, proxy.hostname));
    let fase: "saludo" | "pedido" = "saludo";
    let buf = Buffer.alloc(0);

    const fallar = (msg: string) => {
      limpiar();
      socket.destroy();
      reject(new Error(msg));
    };
    const onError = (err: Error) => fallar(`proxy inaccesible: ${err.message}`);
    // OpenSSH con PermitRemoteOpen no contesta un destino prohibido: corta.
    const onClose = () => fallar("el proxy cortó antes de abrir el túnel (¿destino no permitido?)");
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      if (fase === "saludo") {
        if (buf.length < 2) return;
        if (buf[0] !== 0x05 || buf[1] !== 0x00) {
          fallar("el proxy SOCKS exige autenticación o no es SOCKS5");
          return;
        }
        buf = buf.subarray(2);
        fase = "pedido";
        const nombre = Buffer.from(host);
        socket.write(
          Buffer.concat([
            Buffer.from([0x05, 0x01, 0x00, 0x03, nombre.length]),
            nombre,
            Buffer.from([port >> 8, port & 0xff]),
          ]),
        );
      }
      if (buf.length < 5) return;
      if (buf[1] !== 0x00) {
        fallar(`el proxy rechazó el túnel: SOCKS ${SOCKS_ERRORES[buf[1]] ?? `código ${buf[1]}`}`);
        return;
      }
      // La respuesta trae la dirección enlazada, de largo variable según ATYP.
      const largo = buf[3] === 0x01 ? 4 : buf[3] === 0x04 ? 16 : buf[3] === 0x03 ? 1 + buf[4] : -1;
      if (largo < 0) {
        fallar("respuesta SOCKS inválida");
        return;
      }
      const total = 4 + largo + 2;
      if (buf.length < total) return;
      limpiar();
      // NO pausar: el cliente HTTP no reanuda un socket pausado a mano y el
      // pedido queda colgado. No se pierde nada: tras la respuesta SOCKS el
      // destino no manda un byte hasta que hable el cliente (TLS o HTTP).
      if (buf.length > total) socket.unshift(buf.subarray(total));
      resolve(socket);
    };
    function limpiar() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    }

    socket.on("error", onError);
    socket.on("close", onClose);
    socket.on("data", onData);
    socket.on("connect", () => socket.write(Buffer.from([0x05, 0x01, 0x00])));
  });
