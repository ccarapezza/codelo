// El contrato con el SDK de OpenAI, contra un servidor local que lo imita.
//
// Existe porque el typecheck de este repo casi no dice nada sobre el SDK:
// `strict: false` deja pasar un campo que se volvió opcional y `skipLibCheck:
// true` ni mira sus .d.ts. Y los tests de prompts mockean `openai` entero, así
// que tampoco tocan el paquete real. Subir de major con eso como única evidencia
// es subir a ciegas: el salto de v4 a v7 pasó typecheck sin una sola queja.
//
// Esto levanta un OpenAI de mentira, corre el SDK DE VERDAD contra él y mira las
// dos mitades que nos importan: que lo que mandamos llegue como esperamos, y que
// lo que leemos de la respuesta siga estando donde lo leemos. Sin clave y sin
// gastar un centavo.
//
// No cubre lo que sólo se ve contra la API real: límites de rate, formas de
// error, modelos que cambian de parámetros. Para eso no hay atajo.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import OpenAI from "openai";

interface Pedido {
  url: string;
  body: Record<string, any> | null;
  auth?: string;
}

const pedidos: Pedido[] = [];
let server: http.Server;
let client: OpenAI;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      pedidos.push({
        url: req.url ?? "",
        body: body ? JSON.parse(body) : null,
        auth: req.headers.authorization,
      });
      res.setHeader("Content-Type", "application/json");
      if (req.url?.includes("/chat/completions")) {
        res.end(
          JSON.stringify({
            id: "chatcmpl-x",
            object: "chat.completion",
            created: 1,
            model: "gpt-4o-mini",
            choices: [
              { index: 0, message: { role: "assistant", content: "  Hola mundo  " }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
          }),
        );
      } else if (req.url?.includes("/images/generations")) {
        res.end(JSON.stringify({ created: 1, data: [{ b64_json: "aGVsbG8=" }] }));
      } else if (req.url?.includes("/responses")) {
        res.end(
          JSON.stringify({
            id: "resp_x",
            object: "response",
            created_at: 1,
            model: "gpt-4o-mini",
            status: "completed",
            output: [
              {
                type: "message",
                role: "assistant",
                status: "completed",
                content: [{ type: "output_text", text: "resultado de la búsqueda", annotations: [] }],
              },
            ],
          }),
        );
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as { port: number };
  client = new OpenAI({ apiKey: "sk-falsa-para-la-prueba", baseURL: `http://127.0.0.1:${port}/v1` });
});

afterAll(() => server?.close());

const ultimo = (fragmento: string): Pedido =>
  [...pedidos].reverse().find((p) => p.url.includes(fragmento))!;

describe("chat.completions.create", () => {
  // El camino de 13 de las 17 llamadas del motor: redactor, Director,
  // deduplicador, traductor, composer.
  it("manda lo que le damos y devuelve lo que leemos", async () => {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
    });
    // Lo que leemos en openai.ts, translate-field.ts, news-generator.ts…
    expect(res.choices[0]?.message?.content?.trim()).toBe("Hola mundo");

    const p = ultimo("chat/completions");
    expect(p.body?.temperature).toBe(0);
    expect(p.body?.response_format).toEqual({ type: "json_object" });
    expect(p.body?.messages).toHaveLength(2);
    expect(p.auth).toMatch(/^Bearer sk-/);
  });
});

describe("images.generate", () => {
  it("manda el prompt y devuelve data[0].b64_json", async () => {
    const res = await client.images.generate({
      model: "gpt-image-1-mini",
      prompt: "un gato",
      size: "1024x1024",
    });
    // openai.ts lee data[0].b64_json y, si no está, data[0].url.
    expect(res.data?.[0]?.b64_json).toBe("aGVsbG8=");

    const p = ultimo("images/generations");
    expect(p.body?.prompt).toBe("un gato");
    expect(p.body?.size).toBe("1024x1024");
  });
});

describe("responses.create", () => {
  it("devuelve output_text y el output recorrible", async () => {
    const res = await client.responses.create({ model: "gpt-4o-mini", input: "buscá algo" });
    // news-generator.ts usa output_text y, como respaldo, recorre output[].content[].
    expect(res.output_text).toContain("resultado");
    expect(res.output?.[0]).toMatchObject({ type: "message" });
    const parte = (res.output?.[0] as { content?: Array<{ type: string }> })?.content?.[0];
    expect(parte?.type).toBe("output_text");
  });
});
