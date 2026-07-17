#!/usr/bin/env node
// Manual smoke test for the OpenRouter Nano Banana image path — independent of Strapi.
// Usage:
//   cd apps/codelo-cms && OPENROUTER_API_KEY=... node scripts/check-openrouter.mjs [model]
//   model defaults to google/gemini-2.5-flash-image (Nano Banana).
// Writes the generated image to ./openrouter-out.<ext> and prints size + usage.
import * as fs from "node:fs";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not set. Get one at https://openrouter.ai/keys");
  process.exit(1);
}

const model = process.argv[2] || "google/gemini-2.5-flash-image";
const prompt =
  "Wide cinematic editorial photograph of a football stadium at golden hour, " +
  "dramatic lighting, no text, no logos. Magazine cover style.";

console.log(`Requesting image from ${model} via OpenRouter...`);

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://cogollosdeloeste.example",
    "X-Title": "codelo-cms",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
  }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}:`, await res.text());
  process.exit(1);
}

const data = await res.json();
const msg = data.choices?.[0]?.message;
const images = msg?.images;
if (!images?.length) {
  console.error("No images in response. message keys:", msg ? Object.keys(msg) : "(no message)");
  console.error("Full response (truncated):", JSON.stringify(data).slice(0, 1500));
  process.exit(1);
}

const url = images[0]?.image_url?.url || images[0]?.url;
if (!url?.startsWith("data:")) {
  console.error("Unexpected image entry shape:", JSON.stringify(images[0]).slice(0, 300));
  process.exit(1);
}

const [meta, b64] = url.split(",");
const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
const ext = mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "bin";
const out = `openrouter-out.${ext}`;
fs.writeFileSync(out, Buffer.from(b64, "base64"));
console.log(`OK — wrote ${out} (${fs.statSync(out).size} bytes, ${mime})`);
console.log("usage:", JSON.stringify(data.usage));
