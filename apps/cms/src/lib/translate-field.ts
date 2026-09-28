// Traduce al inglés un campo de configuración editorial.
//
// Los campos de instrucción del panel van en inglés —todo el andamiaje del motor
// lo está y los modelos rinden mejor y gastan menos ahí—, pero el mercado de
// esto es hispanohablante. Esto deja escribir en español y traducir.
//
// Va en las dos direcciones. La inversa —del inglés al idioma del usuario— es
// la que hace que el modo "escribir en mi idioma" sirva en una instancia ya
// configurada: sin ella, al cambiar de modo se ven campos vacíos y el modo no
// sirve para nada.
//
// ⚠️ NO es el traductor de notas (lib/translate-post.ts). Ese traduce prosa para
// un lector; esto traduce INSTRUCCIONES para un modelo, donde una licencia
// estilística puede cambiar lo que el prompt ordena. De ahí las reglas duras de
// abajo, y de ahí que el resultado se le muestre al usuario antes de guardarlo:
// una traducción sutilmente distinta que quede activa sin que nadie la lea es
// exactamente el modo de falla que este proyecto viene cerrando.

import type OpenAI from "openai";

const SYSTEM = [
  "You translate configuration text for an AI content pipeline into English.",
  "The text is an INSTRUCTION that will be injected into a prompt for a language model.",
  "",
  "## Rules",
  "- Translate meaning exactly. Do not soften, expand, summarise or improve the instruction.",
  "- Keep the structure EXACTLY: same line breaks, same bullets, same headings, same blank lines.",
  "- Keep proper nouns, brand names, institutions, programmes and acronyms as they are.",
  // Medido: sin el ejemplo, el modelo traduce "[entidad]" a "[entity]" y rompe
  // el marcador que el redactor después tiene que reemplazar.
  "- NEVER translate placeholders. Anything inside [square brackets], {curly braces} or <angle brackets> is copied CHARACTER FOR CHARACTER, even if it is a Spanish word. `[entidad]` stays `[entidad]`.",
  "- Imperatives stay imperative. A hard rule must read as a hard rule in English.",
  "- If a sentence is already in English, leave it as it is.",
  "",
  "Return ONLY the translated text. No preamble, no quotes, no explanation.",
].join("\n");

export async function translateFieldToEnglish(
  client: OpenAI,
  model: string,
  text: string,
): Promise<string> {
  const res = await client.chat.completions.create({
    model,
    // Temperatura baja: acá no se quiere creatividad, se quiere fidelidad.
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text },
    ],
  });
  const out = res.choices[0]?.message?.content?.trim();
  if (!out) throw new Error("El modelo no devolvió traducción.");
  return out;
}

const SYSTEM_INVERSA = [
  "You translate configuration text for an AI content pipeline OUT OF English.",
  "Each value is an INSTRUCTION that is injected into a prompt for a language model.",
  "The translation is shown to a human so they can read and edit it in their own language.",
  "",
  "## Rules",
  "- Translate meaning exactly. Do not soften, expand, summarise or improve the instruction.",
  "- Keep the structure EXACTLY: same line breaks, same bullets, same headings, same blank lines.",
  "- Keep proper nouns, brand names, institutions, programmes and acronyms as they are.",
  "- NEVER translate placeholders. Anything inside [square brackets], {curly braces} or <angle brackets> is copied CHARACTER FOR CHARACTER.",
  "- Imperatives stay imperative. A hard rule must read as a hard rule.",
  "",
  "Return STRICT JSON with exactly the same keys you received, each mapped to its translation.",
].join("\n");

/**
 * Traduce varios campos DEL inglés al idioma del usuario, en una sola llamada.
 *
 * Una por campo serían quince llamadas cada vez que alguien cambia de modo. Una
 * sola además le da al modelo los campos juntos, que es mejor para mantener
 * consistencia de términos entre ellos.
 */
export async function translateFieldsFromEnglish(
  client: OpenAI,
  model: string,
  fields: Record<string, string>,
  targetLanguage: string,
): Promise<Record<string, string>> {
  const claves = Object.keys(fields);
  if (claves.length === 0) return {};

  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${SYSTEM_INVERSA}\n\nTranslate into ${targetLanguage}.` },
      { role: "user", content: JSON.stringify(fields, null, 2) },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  // Sólo las claves que se pidieron, y sólo si volvieron como texto: una clave
  // inventada por el modelo no tiene dónde ir.
  const out: Record<string, string> = {};
  for (const k of claves) {
    if (typeof parsed[k] === "string" && (parsed[k] as string).trim()) {
      out[k] = (parsed[k] as string).trim();
    }
  }
  return out;
}
