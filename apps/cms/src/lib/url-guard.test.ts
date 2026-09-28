import { describe, expect, it } from "vitest";
import { esUrlPublica } from "./url-guard";

describe("esUrlPublica", () => {
  it("deja pasar un feed normal", () => {
    expect(esUrlPublica("https://enolife.com.ar/es/feed/")).toBe(true);
    expect(esUrlPublica("http://www.clarin.com/rss/gourmet/")).toBe(true);
  });

  // El caso real: iprofesional.com declara su feed en una IP de su red interna.
  it("bloquea la IP privada que declaró un medio real", () => {
    expect(esUrlPublica("https://10.109.0.2/rss/home")).toBe(false);
  });

  it("bloquea los rangos privados y el loopback", () => {
    for (const u of [
      "http://127.0.0.1:1337/admin",
      "http://192.168.0.10/feed",
      "http://172.16.4.4/feed",
      "http://172.31.255.255/feed",
      "http://0.0.0.0/feed",
    ]) {
      expect(esUrlPublica(u), u).toBe(false);
    }
  });

  it("deja pasar el rango 172 que SÍ es público", () => {
    // 172.15 y 172.32 quedan fuera de 172.16/12; bloquearlos sería de más.
    expect(esUrlPublica("http://172.15.0.1/feed")).toBe(true);
    expect(esUrlPublica("http://172.32.0.1/feed")).toBe(true);
  });

  it("bloquea el metadata de la nube", () => {
    expect(esUrlPublica("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("bloquea los nombres de servicio de docker-compose", () => {
    // Así se llaman los servicios entre ellos: sin punto y resolubles adentro.
    expect(esUrlPublica("http://postgres:5432/")).toBe(false);
    expect(esUrlPublica("http://cms:1337/admin")).toBe(false);
    expect(esUrlPublica("http://localhost/feed")).toBe(false);
  });

  it("bloquea esquemas que no son HTTP", () => {
    expect(esUrlPublica("file:///etc/passwd")).toBe(false);
    expect(esUrlPublica("gopher://evil/feed")).toBe(false);
    expect(esUrlPublica("no-es-una-url")).toBe(false);
  });

  it("bloquea IPv6 local y la IPv4 mapeada", () => {
    expect(esUrlPublica("http://[::1]/feed")).toBe(false);
    expect(esUrlPublica("http://[fd00::1]/feed")).toBe(false);
    expect(esUrlPublica("http://[::ffff:127.0.0.1]/feed")).toBe(false);
  });
});
