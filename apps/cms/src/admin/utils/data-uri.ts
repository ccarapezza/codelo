// Una data URI en base64 → Blob, en el navegador y sin red.
//
// El atajo de siempre, `fetch(uri).then((r) => r.blob())`, no sirve en el
// panel: `fetch` cae bajo `connect-src`, y la CSP del admin
// (`config/middlewares.ts`) sólo permite `'self'` y `https:`. El navegador lo
// bloquea y el error llega como un TypeError genérico, sin nombrar la CSP. Las
// imágenes `data:` se VEN igual, porque para eso manda `img-src`, que sí las
// permite: por eso la preview andaba y la descarga no.
export function dataUriToBlob(uri: string): Blob {
  const coma = uri.indexOf(",");
  const cabecera = coma === -1 ? "" : uri.slice(0, coma);
  if (!cabecera.startsWith("data:") || !cabecera.endsWith(";base64")) {
    throw new Error("No es una data URI en base64.");
  }
  const mime = cabecera.slice("data:".length, -";base64".length) || "application/octet-stream";
  const binario = atob(uri.slice(coma + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
