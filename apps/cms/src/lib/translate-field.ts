// Traduce al inglés un campo de configuración editorial.
//
// Los campos de instrucción del panel van en inglés —todo el andamiaje del motor
// lo está y los modelos rinden mejor y gastan menos ahí—, pero el mercado de
// esto es hispanohablante. Esto deja escribir en español y traducir.
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
