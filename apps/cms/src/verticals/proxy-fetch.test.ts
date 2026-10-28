import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { fetchViaProxy, proxyLabel } from "./proxy-fetch";

// Un destino HTTP y un proxy CONNECT reales, en loopback. El destino es HTTP
// plano para no tener que fabricar certificados: el túnel es el mismo, el TLS
// de punta a punta lo pone `tls.connect` y no cambia lo que se prueba acá.

const servers: net.Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

function listen<T extends net.Server>(server: T): Promise<number> {
  servers.push(server);
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)),
  );
}

type Recibido = { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string };

async function destino(): Promise<{ port: number; recibido: Recibido[] }> {
  const recibido: Recibido[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      recibido.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(req.url === "/falta" ? 404 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: 0, eco: body }));
    });
  });
  return { port: await listen(server), recibido };
}

/** Proxy CONNECT mínimo. Con `exigir`, responde 407 sin esas credenciales. */
async function proxy(opts?: { exigir?: string }): Promise<{ port: number; connects: Recibido[] }> {
  const connects: Recibido[] = [];
  const server = http.createServer();
  server.on("connect", (req, client, head) => {
    connects.push({ method: req.method, url: req.url, headers: req.headers, body: "" });
    if (opts?.exigir && req.headers["proxy-authorization"] !== opts.exigir) {
      client.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
      return;
    }
    const [host, port] = (req.url ?? "").split(":");
    const upstream = net.connect(Number(port), host, () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
  });
  return { port: await listen(server), connects };
}

describe("fetchViaProxy", () => {
  it("pasa el pedido por el túnel, con cuerpo, headers y Host del destino", async () => {
    const d = await destino();
    const p = await proxy();
    const res = await fetchViaProxy(
      `http://127.0.0.1:${d.port}/busqueda?x=1`,
      `http://127.0.0.1:${p.port}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
        body: "params=%7B%22texto%22%3A%22c%C3%A1%C3%B1amo%22%7D",
        timeoutMs: 5000,
      },
    );

    expect(res.ok).toBe(true);
    expect(JSON.parse(res.text)).toEqual({ error: 0, eco: "params=%7B%22texto%22%3A%22c%C3%A1%C3%B1amo%22%7D" });

    expect(p.connects).toHaveLength(1);
    expect(p.connects[0].url).toBe(`127.0.0.1:${d.port}`);

    const r = d.recibido[0];
    expect(r.method).toBe("POST");
    expect(r.url).toBe("/busqueda?x=1");
    expect(r.headers.host).toBe(`127.0.0.1:${d.port}`);
    expect(r.headers["x-requested-with"]).toBe("XMLHttpRequest");
    expect(r.headers["content-length"]).toBe(String(r.body.length));
  });

  it("manda las credenciales del proxy como Proxy-Authorization, decodificadas", async () => {
    const esperado = `Basic ${Buffer.from("codelo:cl@ve").toString("base64")}`;
    const d = await destino();
    const p = await proxy({ exigir: esperado });
    const res = await fetchViaProxy(`http://127.0.0.1:${d.port}/`, `http://codelo:cl%40ve@127.0.0.1:${p.port}`, {
      timeoutMs: 5000,
    });
    expect(res.ok).toBe(true);
    // Al destino no le llegan: son del proxy.
    expect(d.recibido[0].headers["proxy-authorization"]).toBeUndefined();
  });

  it("un 407 del proxy es un error que nombra al proxy", async () => {
    const p = await proxy({ exigir: "Basic otra" });
    await expect(
      fetchViaProxy("http://127.0.0.1:9/", `http://127.0.0.1:${p.port}`, { timeoutMs: 5000 }),
    ).rejects.toThrow(/proxy rechazó el túnel: HTTP 407/);
  });

  it("un proxy que no atiende es un error que lo dice", async () => {
    const libre = await listen(net.createServer());
    await new Promise((r) => servers.pop()!.close(r));
    await expect(
      fetchViaProxy("http://127.0.0.1:9/", `http://127.0.0.1:${libre}`, { timeoutMs: 5000 }),
    ).rejects.toThrow(/proxy inaccesible/);
  });

  it("un status no-2xx del destino vuelve con ok=false, no como excepción", async () => {
    const d = await destino();
    const p = await proxy();
    const res = await fetchViaProxy(`http://127.0.0.1:${d.port}/falta`, `http://127.0.0.1:${p.port}`, {
      timeoutMs: 5000,
    });
    expect(res).toMatchObject({ status: 404, ok: false });
  });

  it("corta por timeout si el proxy acepta y no contesta, y cierra la conexión", async () => {
    // Lee y descarta: un socket que nadie lee nunca procesa el FIN del cliente,
    // y la conexión parecería abierta aunque el cliente la haya cerrado.
    const mudo = net.createServer((s) => s.resume());
    const port = await listen(mudo);
    const t0 = Date.now();
    await expect(
      fetchViaProxy("http://127.0.0.1:9/", `http://127.0.0.1:${port}`, { timeoutMs: 300 }),
    ).rejects.toThrow(/timeout de 300 ms/);
    expect(Date.now() - t0).toBeLessThan(2000);

    await new Promise((r) => setTimeout(r, 100));
    const abiertas = await new Promise<number>((r) => mudo.getConnections((_, n) => r(n)));
    expect(abiertas).toBe(0);
  });
});

/**
 * SOCKS5 mínimo, como el que arma `ssh -R puerto`: sin autenticación, destino
 * por nombre. Con `permitir`, se comporta como OpenSSH con PermitRemoteOpen:
 * a un destino que no está en la lista no le contesta, corta.
 */
async function socks(opts?: { permitir?: string; rechazarCon?: number }): Promise<{ port: number; pedidos: string[] }> {
  const pedidos: string[] = [];
  const server = net.createServer((client) => {
    let fase = 0;
    client.on("error", () => {});
    client.on("data", function onData(chunk) {
      if (fase === 0) {
        expect([...chunk]).toEqual([0x05, 0x01, 0x00]);
        client.write(Buffer.from([0x05, 0x00]));
        fase = 1;
        return;
      }
      client.off("data", onData);
      expect(chunk[3]).toBe(0x03); // destino por nombre, no por IP
      const host = chunk.subarray(5, 5 + chunk[4]).toString();
      const port = chunk.readUInt16BE(5 + chunk[4]);
      pedidos.push(`${host}:${port}`);
      if (opts?.rechazarCon) {
        client.end(Buffer.from([0x05, opts.rechazarCon, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        return;
      }
      if (opts?.permitir && `${host}:${port}` !== opts.permitir) {
        client.destroy();
        return;
      }
      // "localhost" en el pedido: el proxy resuelve, como haría la PC de casa.
      const up = net.connect(port, host === "localhost" ? "127.0.0.1" : host, () => {
        client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
        up.pipe(client);
        client.pipe(up);
      });
      up.on("error", () => client.destroy());
    });
  });
  return { port: await listen(server), pedidos };
}

describe("fetchViaProxy por SOCKS5", () => {
  it("pasa el pedido por el túnel y pide el destino por nombre", async () => {
    const d = await destino();
    const s = await socks();
    const res = await fetchViaProxy(`http://localhost:${d.port}/busqueda`, `socks5h://127.0.0.1:${s.port}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "params=1",
      timeoutMs: 5000,
    });
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.text)).toEqual({ error: 0, eco: "params=1" });
    expect(s.pedidos).toEqual([`localhost:${d.port}`]);
    expect(d.recibido[0].headers.host).toBe(`localhost:${d.port}`);
  });

  it("un destino fuera de PermitRemoteOpen es un error que lo sugiere", async () => {
    const s = await socks({ permitir: "www.boletinoficial.gob.ar:443" });
    await expect(
      fetchViaProxy("http://example.com/", `socks5://127.0.0.1:${s.port}`, { timeoutMs: 5000 }),
    ).rejects.toThrow(/destino no permitido/);
  });

  it("un rechazo SOCKS explícito sale con su significado", async () => {
    const s = await socks({ rechazarCon: 5 });
    await expect(
      fetchViaProxy("http://localhost:9/", `socks5://127.0.0.1:${s.port}`, { timeoutMs: 5000 }),
    ).rejects.toThrow(/SOCKS conexión rechazada/);
  });

  it("un proxy SOCKS que no atiende es un error que lo dice", async () => {
    const libre = await listen(net.createServer());
    await new Promise((r) => servers.pop()!.close(r));
    await expect(
      fetchViaProxy("http://localhost:9/", `socks5://127.0.0.1:${libre}`, { timeoutMs: 5000 }),
    ).rejects.toThrow(/proxy inaccesible/);
  });
});

describe("proxyLabel", () => {
  it("usa el nombre del fragmento, o host:puerto; nunca las credenciales", () => {
    expect(proxyLabel("socks5h://host.docker.internal:18881#nitro")).toBe("nitro");
    expect(proxyLabel("http://user:secreta@proxy.example:8080")).toBe("proxy.example:8080");
  });
});
