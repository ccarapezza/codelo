import OpenAI from "openai";
import { generateOpenRouterImage } from "./openrouter-image";
import { DEFAULT_PROMPT_SETTINGS } from "./prompt-defaults";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type GeneratedPost = {
  title: string;
  excerpt: string;
  content: string;
};

export function getOpenAIClient(apiKey: string): OpenAI {
  // Force the SDK to use Node's global fetch. openai@4's bundled HTTP client
  // started failing every chat-completion with "Invalid response body … Premature
  // close" around 2026-06-18 (OpenAI changed something server-side that the old
  // client can't handle) — which silently stopped all post generation. Verified
  // in prod via A/B: raw global fetch returns 200 every time on the exact same
  // payload/model, while the SDK's default client throws every time; passing the
  // global fetch through makes the SDK succeed again.
  return new OpenAI({ apiKey, fetch: (...args) => globalThis.fetch(...args) });
}

// The model is told to bold key names/teams in the BODY, and sometimes leaks
// that markdown into the `title`/`excerpt` fields too (e.g. `**England** ganó…`).
// Those fields are rendered as PLAIN TEXT, so the marks show literally. Strip
// inline markdown from them here — the single choke point both flows pass
// through. Leaves `content` untouched (it IS markdown).
export function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_]+)__/g, "$1") // __bold__
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2") // *italic* (not lists)
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url)
    .replace(/^#{1,6}\s+/, "") // leading heading
    .replace(/[*_`]/g, "") // any leftover marks
    .replace(/\s+/g, " ")
    .trim();
}

async function callJson(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<GeneratedPost> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  if (!parsed.title || !parsed.content) {
    throw new Error("OpenAI response missing required fields (title, content)");
  }

  return {
    title: stripInlineMarkdown(String(parsed.title)),
    excerpt: stripInlineMarkdown(String(parsed.excerpt ?? "")),
    content: String(parsed.content).trim(),
  };
}

export async function generatePost(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<GeneratedPost> {
  return callJson(client, model, systemPrompt, userPrompt);
}

// Generic image-safety constraint, appended to EVERY image-prompt system message
// regardless of which instructions the admin configures. Keeping it in code (not
// in the editable imageSystemInstructions field) guarantees the no-faces /
// no-logos likeness rule can never be removed by an admin edit.
const SAFETY_SUFFIX =
  "Hard constraint: NO recognizable real faces (silhouettes/backs/hands OK). End with: No text, no watermarks, no logos.";

// The domain-specific image system instructions and the THEME → SCENE CUES guide
// now live in the editable `prompt-setting` single type (defaults in
// prompt-defaults.ts). The caller resolves them and passes them in.

// ─── Rotation pools (Fase B) ─────────────────────────────────────────────
// Three orthogonal axes — composition / mood / style — picked deterministically
// from a per-article seed so the same post regenerated twice yields identical
// constraints, but different posts (different seeds) yield different combos.

const COMPOSITIONS = [
  "macro close-up with shallow depth of field",
  "aerial top-down flat lay",
  "wide environmental shot with leading lines",
  "through-window or doorway framed composition",
  // NOT a split/two-panel composition: that contradicts the anti-diptych hard
  // rule in imageSystemInstructions, and the model obeyed the composition over
  // the rule every time the seed landed here.
  "centred symmetric composition with a single subject",
  "diagonal low-angle perspective",
  "backlit silhouette against a bright ground",
  "close third-person over-the-shoulder view",
] as const;

// ─── Visual treatment (the anti-monotony dimension) ──────────────────────
// Covers used to be uniformly photorealistic because photorealism was asserted
// in three places at once: the system instructions, the user prompt, and a
// STYLES pool whose every entry was a photographic style. The treatment is now
// the thing the seed rotates, and it decides whether the cover is a photograph
// at all. Roughly a third stay photographic — a news portal still needs
// credible photo covers — and the rest are drawn, printed or diagrammatic.
type TreatmentKind = "photo" | "art";
interface Treatment {
  kind: TreatmentKind;
  value: string;
}

const TREATMENTS: ReadonlyArray<Treatment> = [
  { kind: "photo", value: "documentary photojournalism: natural light, unstaged, reportage framing" },
  { kind: "photo", value: "modern minimalist editorial photography with generous negative space" },
  { kind: "photo", value: "macro nature photography with scientific clarity and fine texture detail" },
  { kind: "photo", value: "archival 1970s film photograph: visible grain, faded dyes, slight vignette" },
  { kind: "art",   value: "19th-century botanical plate: precise ink linework, hand-tinted watercolour washes, herbarium-sheet layout" },
  { kind: "art",   value: "risograph print: two or three spot inks, visible misregistration, paper tooth showing through" },
  { kind: "art",   value: "linocut relief print: bold carved strokes, stark high contrast, two-colour palette" },
  { kind: "art",   value: "flat vector editorial illustration: geometric shapes, limited palette, poster-like clarity" },
  { kind: "art",   value: "annotated technical diagram: cross-sections, callout leader lines, schematic clarity" },
  { kind: "art",   value: "cut-paper collage: layered textured papers, hard-edged shapes, soft drop shadows" },
  { kind: "art",   value: "ink wash brushwork: gestural strokes, controlled bleed, wide areas of empty paper" },
  { kind: "art",   value: "engraved etching from an old scientific journal: fine cross-hatching, sepia ink on cream stock" },
];

// A photograph's variable axis is light; a drawing's is ink, palette and mark-
// making. Feeding "golden hour with long shadows" to a linocut just produces a
// confused hybrid, so each treatment kind draws from its own pool.
type MoodTone = "warm" | "cool" | "harsh" | "night" | "muted" | "vivid";
const MOODS: ReadonlyArray<{ tone: MoodTone; value: string }> = [
  { tone: "warm",  value: "golden hour warm light with long shadows" },
  { tone: "cool",  value: "blue hour cold light, melancholy mood" },
  { tone: "harsh", value: "harsh midday sun, high contrast" },
  { tone: "night", value: "single hard light source at night, deep shadows" },
  { tone: "muted", value: "overcast diffused light, desaturated palette" },
  { tone: "warm",  value: "dusk amber light with dramatic clouds" },
  { tone: "cool",  value: "dawn pale blue light, mist in the air" },
  { tone: "vivid", value: "raking side light, saturated colours" },
  { tone: "muted", value: "monochrome / duotone editorial treatment" },
];

const ART_RENDERS: ReadonlyArray<{ tone: MoodTone; value: string }> = [
  { tone: "warm",  value: "warm ochre and terracotta inks on cream stock" },
  { tone: "cool",  value: "indigo and slate inks with cold negative space" },
  { tone: "vivid", value: "two saturated spot colours overprinted where they overlap" },
  { tone: "muted", value: "muted earth palette, heavy paper texture, soft edges" },
  { tone: "harsh", value: "stark black ink on bare paper, no midtones" },
  { tone: "warm",  value: "amber and deep-blue duotone, matching the house palette" },
  { tone: "cool",  value: "pale washes with a single accent colour" },
  { tone: "muted", value: "sepia monochrome with fine hatching for shading" },
];

function hashSeed(s: string): number {
  // djb2 — fast, low collision for short strings.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

function pickFromPool<T>(pool: ReadonlyArray<T>, seed: number, offset = 0): T {
  return pool[(seed + offset) % pool.length];
}

// Article-derived constraints we feed the prompt generator. Anchors come from
// extractArticleAnchors(); composition/mood/style come from the seed rotation.
export interface PromptConstraints {
  composition: string;
  /** Lighting (photo) or ink/palette (art) — whichever the treatment implies. */
  mood: string;
  treatment: Treatment;
  anchors: ArticleAnchors;
}

export function resolvePromptConstraints(
  seedKey: string,
  anchors: ArticleAnchors,
): PromptConstraints {
  const seed = hashSeed(seedKey);
  const treatment = pickFromPool(TREATMENTS, seed, 13);
  // The mood pool follows the treatment: lighting for photographs, ink and
  // palette for everything drawn or printed.
  const moodPool = treatment.kind === "photo" ? MOODS : ART_RENDERS;
  return {
    composition: pickFromPool(COMPOSITIONS, seed, 0),
    // Offsets are coprime with each pool size to de-correlate the picks.
    mood: pickFromPool(moodPool, seed, 7).value,
    treatment,
    anchors,
  };
}

// ─── Article anchors (Fase D) ────────────────────────────────────────────
// One cheap text-model call to extract entities the cover MUST feature.

// These fields MUST stay in sync with IMAGE_ANCHOR_TAXONOMY in prompt-defaults:
// the taxonomy tells the model what to return, this shape decides what we keep.
// They drifted once — the taxonomy asked for topic/palette/season while the
// parser still read the football-era teamColors/jerseyNumber, so three of five
// anchors were silently dropped on every cover.
export interface ArticleAnchors {
  topic: string | null;          // e.g. "cultivo", "legal", "salud"
  palette: string | null;        // e.g. "warm greens and wood tones"
  eventType: string | null;      // "taller", "trámite", "fallo", etc.
  venue: string | null;          // place / neighbourhood if explicitly mentioned
  season: string | null;         // growing-cycle stage, if mentioned
}

const EMPTY_ANCHORS: ArticleAnchors = {
  topic: null,
  palette: null,
  eventType: null,
  venue: null,
  season: null,
};

export async function extractArticleAnchors(
  client: OpenAI,
  model: string,
  title: string,
  excerpt: string,
  anchorTaxonomy: string = DEFAULT_PROMPT_SETTINGS.imageAnchorTaxonomy,
): Promise<ArticleAnchors> {
  // Header + JSON shape are fixed scaffolding; the per-field rules are the
  // domain-specific, admin-editable part (anchorTaxonomy).
  const system = [
    "You extract concrete visual anchors from a news article to guide cover-image generation.",
    "Return STRICT JSON matching exactly this shape (use null when the article does not mention the field):",
    `{ "topic": string|null, "palette": string|null, "eventType": string|null, "venue": string|null, "season": string|null }`,
    "",
    "Rules:",
    anchorTaxonomy,
  ].join("\n");

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Title: ${title}\nExcerpt: ${excerpt.slice(0, 600)}\n\nReturn only the JSON.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ArticleAnchors>;
    return {
      topic: typeof parsed.topic === "string" ? parsed.topic.trim() : null,
      palette: typeof parsed.palette === "string" ? parsed.palette.trim() : null,
      eventType: typeof parsed.eventType === "string" ? parsed.eventType.trim() : null,
      venue: typeof parsed.venue === "string" ? parsed.venue.trim() : null,
      season: typeof parsed.season === "string" ? parsed.season.trim() : null,
    };
  } catch {
    // Anchor extraction is enrichment — never block the cover on its failure.
    return { ...EMPTY_ANCHORS };
  }
}

/**
 * Semantic de-duplication gate. Decides whether a CANDIDATE headline reports the
 * same specific event as any of the recent post titles. Returns the matching
 * title, or null. This catches "same event, different wording" (which lexical
 * similarity misses) while NOT flagging a match preview vs its result, two
 * different teams doing the same kind of thing, or a genuine follow-up — cases
 * where a Jaccard threshold is simultaneously too strict and too loose.
 */
export async function findDuplicateSubject(
  client: OpenAI,
  model: string,
  candidateTitle: string,
  recentTitles: string[],
): Promise<string | null> {
  if (recentTitles.length === 0) return null;
  const system = [
    "You are a news-desk de-duplication checker for a non-profit info portal covering cannabis, hemp, drug policy, health and the environment.",
    "Decide whether a CANDIDATE headline reports the SAME specific event as any EXISTING headline.",
    "Same event = same subject AND the same concrete happening: e.g. the same published regulation, the same court ruling, the same study, the same licence granted to the same organisation.",
    "These are NOT duplicates: a bill's INTRODUCTION vs its later SANCTION; two DIFFERENT organisations each obtaining their own licence or registry; the same law cited as background in two unrelated articles; an explainer about a procedure vs news of that procedure changing; a follow-up that adds genuinely new facts.",
    'Return STRICT JSON: { "duplicateIndex": number } — the 1-based index of the EXISTING headline that is the same event, or 0 if none match.',
  ].join("\n");
  const list = recentTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `CANDIDATE:\n${candidateTitle}\n\nEXISTING:\n${list}\n\nReturn only the JSON.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { duplicateIndex?: number };
    const idx = typeof parsed.duplicateIndex === "number" ? parsed.duplicateIndex : 0;
    return idx >= 1 && idx <= recentTitles.length ? recentTitles[idx - 1] : null;
  } catch {
    // Never block post creation because the checker failed.
    return null;
  }
}

export interface GenerateImagePromptOptions {
  /** Resolved system instructions (per-agent override OR vertical default). */
  systemInstructions?: string | null;
  /** THEME → SCENE CUES taxonomy injected into the user prompt. */
  themeGuide?: string;
  constraints?: PromptConstraints;
  recentDescriptions?: string[];
  /** How many candidate prompts to generate. Default 1. */
  candidates?: number;
  /** Override temperature; defaults to 0.95 for variety. */
  temperature?: number;
}

function buildUserPrompt(
  title: string,
  excerpt: string,
  constraints: PromptConstraints | undefined,
  recentDescriptions: string[],
  themeGuide: string,
): string {
  const sections: string[] = [
    `Create an editorial cover image description for this news article.`,
    ``,
    `Title: "${title}"`,
    `Summary: "${excerpt.slice(0, 400)}"`,
    ``,
  ];

  if (constraints) {
    const { composition, mood, treatment, anchors } = constraints;
    const isPhoto = treatment.kind === "photo";
    sections.push(
      `HARD CONSTRAINTS for this specific cover (these override theme defaults if they conflict):`,
      // The medium leads: everything below is read in its terms, and the theme
      // guide's cues are scenes to depict, not an instruction to photograph.
      `- Medium: ${isPhoto ? "photograph" : "illustration / print — NOT a photograph"}`,
      `- Treatment: ${treatment.value}`,
      `- Composition: ${composition}`,
      isPhoto ? `- Lighting mood: ${mood}` : `- Ink and palette: ${mood}`,
      ``,
    );
    if (!isPhoto) {
      sections.push(
        `Because this cover is illustrated, your description MUST name the medium explicitly in its FIRST clause (e.g. "A linocut print of…", "A botanical plate showing…"). Then describe it as artwork: name the marks, ink, texture and paper. Do NOT use photographic vocabulary (lens, depth of field, bokeh, exposure, shot on...). The scene cues below are WHAT to depict; the treatment above is HOW to render it.`,
        ``,
      );
    }
    const anchorLines: string[] = [];
    if (anchors.topic) anchorLines.push(`- Topic to depict: ${anchors.topic}`);
    if (anchors.palette) anchorLines.push(`- Colour palette: ${anchors.palette}`);
    if (anchors.eventType) anchorLines.push(`- Event type to depict: ${anchors.eventType}`);
    if (anchors.venue) anchorLines.push(`- Place context: ${anchors.venue}`);
    if (anchors.season) anchorLines.push(`- Growing-cycle stage: ${anchors.season}`);
    if (anchorLines.length > 0) {
      sections.push(`MUST FEATURE (anchors from this article):`, ...anchorLines, ``);
    }
  }

  if (recentDescriptions.length > 0) {
    sections.push(
      `RECENTLY USED scenes (the last ${recentDescriptions.length} covers — DO NOT replicate any of these; pick a clearly different visual angle):`,
      ...recentDescriptions.map((d, i) => `  ${i + 1}. ${d.slice(0, 200)}`),
      ``,
    );
  }

  sections.push(
    `STEPS:`,
    `1. Identify the core theme of THIS specific article.`,
    `2. Choose ONE category from THEME → SCENE CUES, then ONE variant (a/b/c/d) — this is the SUBJECT only.`,
    `3. Render that subject in the medium and treatment specified above.`,
    `4. Bake in the composition and ink/lighting constraints, plus any anchors.`,
    `5. Output a single dense paragraph, 2-3 sentences max.`,
    ``,
    themeGuide,
  );

  if (constraints) {
    sections.push(
      ``,
      `Reminder: the medium MUST be ${constraints.treatment.kind === "photo" ? "a photograph" : "an illustration, not a photograph"}, rendered as "${constraints.treatment.value}", with composition "${constraints.composition}". Do not drift.`,
    );
  }

  return sections.join("\n");
}

/**
 * Single-shot prompt generation. Kept for backwards compatibility with the
 * "Generate cover" admin endpoint flow that wants exactly one prompt back.
 */
export async function generateImagePrompt(
  client: OpenAI,
  model: string,
  title: string,
  excerpt: string,
  options: GenerateImagePromptOptions = {},
): Promise<string> {
  const candidates = await generateImagePromptCandidates(client, model, title, excerpt, {
    ...options,
    candidates: 1,
  });
  return candidates[0];
}

/**
 * Generate N candidate prompts in one chat completion call (using `n`).
 * The judge step then picks the most-different one from the recent pool.
 */
export async function generateImagePromptCandidates(
  client: OpenAI,
  model: string,
  title: string,
  excerpt: string,
  options: GenerateImagePromptOptions = {},
): Promise<string[]> {
  const n = Math.max(1, options.candidates ?? 1);
  // The caller resolves the system instructions (per-agent override → vertical
  // default → hardcoded default). The SAFETY_SUFFIX is appended UNCONDITIONALLY
  // so the no-faces / no-logos rule survives any admin edit of the instructions.
  const base = options.systemInstructions?.trim() || DEFAULT_PROMPT_SETTINGS.imageSystemInstructions;
  const system = `${base}\n\n${SAFETY_SUFFIX}`;

  const themeGuide = options.themeGuide?.trim() || DEFAULT_PROMPT_SETTINGS.imageThemeGuide;
  const user = buildUserPrompt(title, excerpt, options.constraints, options.recentDescriptions ?? [], themeGuide);

  const response = await client.chat.completions.create({
    model,
    n,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: options.temperature ?? 0.95,
  });

  const results = response.choices
    .map((c) => c.message?.content?.trim())
    .filter((s): s is string => Boolean(s));
  if (results.length === 0) {
    throw new Error("Text model returned no candidate image descriptions.");
  }
  return results;
}

/**
 * Pick the candidate that is most visually different from the recent pool.
 * Falls back to candidate[0] if the judge call fails or returns invalid output
 * — never block the cover on judge errors.
 */
export async function judgeImagePrompts(
  client: OpenAI,
  model: string,
  candidates: string[],
  recentDescriptions: string[],
): Promise<number> {
  if (candidates.length <= 1) return 0;

  // Shuffle so the judge's positional bias is decorrelated from generation order.
  const order = candidates.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffled = order.map((i) => candidates[i]);

  const system = [
    `You are a visual editor for an editorial news portal. Given several candidate cover descriptions and a list of recent covers, pick the candidate that is MOST visually distinct from the recent pool — different scene, different composition, different palette.`,
    `Return STRICT JSON: { "index": 0-based integer, "reason": short string }.`,
  ].join("\n");

  const user = [
    `RECENT covers (avoid replicating these):`,
    recentDescriptions.length > 0
      ? recentDescriptions.map((d, i) => `  R${i + 1}. ${d.slice(0, 200)}`).join("\n")
      : "  (none — pick any candidate, prefer the most striking).",
    ``,
    `CANDIDATES:`,
    ...shuffled.map((c, i) => `  C${i}. ${c}`),
    ``,
    `Return the JSON with "index" referring to the C-numbered candidate above.`,
  ].join("\n");

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { index?: number };
    const idx = typeof parsed.index === "number" ? parsed.index : 0;
    const safe = idx >= 0 && idx < shuffled.length ? idx : 0;
    return order[safe];
  } catch {
    return order[0];
  }
}

/**
 * High-level orchestration: extract anchors → resolve constraints from seed →
 * generate 3 candidate prompts → judge picks the most-different from recent.
 * Returns the chosen prompt. All errors in enrichment steps fail soft.
 */
export async function chooseImagePrompt(
  client: OpenAI,
  textModel: string,
  args: {
    title: string;
    excerpt: string;
    seedKey: string;
    recentDescriptions: string[];
    /** Resolved by the caller: per-agent imagePromptTemplate OR vertical imageSystemInstructions. */
    systemInstructions?: string | null;
    /** Vertical THEME → SCENE CUES taxonomy. */
    themeGuide?: string;
    /** Vertical anchor-extraction rules. */
    anchorTaxonomy?: string;
  },
): Promise<string> {
  const anchors = await extractArticleAnchors(client, textModel, args.title, args.excerpt, args.anchorTaxonomy);
  const constraints = resolvePromptConstraints(args.seedKey, anchors);
  const candidates = await generateImagePromptCandidates(client, textModel, args.title, args.excerpt, {
    systemInstructions: args.systemInstructions,
    themeGuide: args.themeGuide,
    constraints,
    recentDescriptions: args.recentDescriptions,
    candidates: 3,
  });
  const chosenIndex = await judgeImagePrompts(client, textModel, candidates, args.recentDescriptions);
  return candidates[chosenIndex];
}

// dall-e-3 only supports these sizes; map gpt-image-1 sizes to the closest valid one
const DALLE3_SIZE_MAP: Record<string, string> = {
  "1536x1024": "1792x1024",
  "1024x1536": "1024x1792",
  "512x512":   "1024x1024",
};

// Quality normalization per model family
const TO_DALLE3_QUALITY: Record<string, string> = {
  low: "standard", medium: "standard", high: "hd",
};
const TO_GPT_IMAGE_QUALITY: Record<string, string> = {
  standard: "low", hd: "high",
};

// Provider is inferred from the model id. OpenRouter ids carry a provider prefix
// (e.g. "google/gemini-2.5-flash-image"); OpenAI-direct ids (gpt-image-*, dall-e-3)
// do not. So a "/" in the id means "route through OpenRouter".
export function isOpenRouterModel(model: string): boolean {
  return model.includes("/");
}

// Map the OpenAI WxH presets the agent stores to Gemini aspect ratios (OpenRouter
// passes these to Gemini via image_config). Supported ratios include 1:1/16:9/9:16.
const OPENROUTER_ASPECT_MAP: Record<string, string> = {
  "1024x1024": "1:1",
  "512x512":   "1:1",
  "1536x1024": "16:9",
  "1792x1024": "16:9",
  "1024x1536": "9:16",
  "1024x1792": "9:16",
};

function mapToOpenRouter(size?: string, quality?: string): { aspectRatio: string; imageSize: string } {
  const aspectRatio = OPENROUTER_ASPECT_MAP[size ?? "1024x1024"] ?? "16:9";
  // Gemini has no low/medium/high knob; treat OpenAI "high"/"hd" as the 2K tier, else 1K.
  const hi = quality === "high" || quality === "hd";
  return { aspectRatio, imageSize: hi ? "2K" : "1K" };
}

// Keys are passed in (not a pre-built client) so the caller doesn't construct an
// OpenAI client it won't use when the model routes to OpenRouter.
export async function generateCoverImage(
  keys: { openaiImageKey?: string; openrouterKey?: string },
  model: string,
  prompt: string,
  options?: { size?: string; quality?: string },
): Promise<Buffer> {
  if (isOpenRouterModel(model)) {
    if (!keys.openrouterKey) throw new Error("OPENROUTER_API_KEY is not configured");
    const { aspectRatio, imageSize } = mapToOpenRouter(options?.size, options?.quality);
    return generateOpenRouterImage(keys.openrouterKey, model, prompt, { aspectRatio, imageSize });
  }

  if (!keys.openaiImageKey) throw new Error("OpenAI image key is not configured");
  const client = getOpenAIClient(keys.openaiImageKey);

  const isDalle3 = model === "dall-e-3";
  const rawSize = options?.size ?? "1024x1024";
  const rawQuality = options?.quality ?? "low";

  const size = isDalle3
    ? (DALLE3_SIZE_MAP[rawSize] ?? rawSize)
    : rawSize;
  const quality = isDalle3
    ? (TO_DALLE3_QUALITY[rawQuality] ?? rawQuality)
    : (TO_GPT_IMAGE_QUALITY[rawQuality] ?? rawQuality);

  const response = await client.images.generate({
    model,
    prompt,
    n: 1,
    size: size as Parameters<typeof client.images.generate>[0]["size"],
    quality: quality as Parameters<typeof client.images.generate>[0]["quality"],
  });

  const b64 = (response.data[0] as { b64_json?: string }).b64_json;
  if (b64) return Buffer.from(b64, "base64");

  const url = response.data[0]?.url;
  if (!url) throw new Error("OpenAI image response has no data.");

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Failed to download image from OpenAI: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// `options.folderId` files the asset into a Media Library folder (Strapi 5
// supports fileInfo.folder); `options.mime` overrides the extension-based
// guess (e.g. "video/mp4" for reel clips). Backward compatible.
export async function uploadImageToStrapi(
  strapi: { plugin: (name: string) => { service: (name: string) => { upload: (opts: unknown) => Promise<Array<{ id: number }>> } } },
  imageBuffer: Buffer,
  filename: string,
  alternativeText: string,
  options?: { folderId?: number; mime?: string },
): Promise<number> {
  const tmpPath = path.join(os.tmpdir(), filename);
  fs.writeFileSync(tmpPath, imageBuffer);
  try {
    const [uploaded] = await strapi
      .plugin("upload")
      .service("upload")
      .upload({
        data: {
          fileInfo: {
            name: filename,
            alternativeText,
            ...(options?.folderId ? { folder: options.folderId } : {}),
          },
        },
        files: {
          filepath: tmpPath,
          originalFilename: filename,
          mimetype: options?.mime ?? (filename.endsWith(".png") ? "image/png" : "image/jpeg"),
          size: fs.statSync(tmpPath).size,
        },
      });
    return uploaded.id;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

export type ReviewResult =
  | ({ rejected: false } & GeneratedPost)
  | { rejected: true; reason: string };

export async function reviewPost(
  client: OpenAI,
  model: string,
  directorInstructions: string,
  draft: GeneratedPost,
  newsContext: string,
  fabricationProneFacts: string = DEFAULT_PROMPT_SETTINGS.fabricationProneFacts,
  brandName: string = DEFAULT_PROMPT_SETTINGS.brandName,
): Promise<ReviewResult> {
  const systemPrompt = [
    "You are a strict editor-in-chief whose ONLY job is to prevent hallucinated news from being published.",
    "Hallucinations almost always come from titles that distort or invent facts, even when the body is reasonable.",
    "",
    "## STEP 1 — TITLE VALIDATION (mandatory, do this FIRST)",
    "",
    "Extract every factual claim made by the TITLE only. For each claim, check:",
    "  a) Is this exact claim supported by AT LEAST ONE source in the verified context?",
    "  b) Does this claim contradict any source in the verified context?",
    "  c) Does this claim contradict the body of the article itself?",
    "",
    "REJECT the article if ANY of the following is true:",
    "  - The title makes a claim about a person/team that no source mentions (e.g. 'Player X is injured' when no source mentions X).",
    "  - The title contradicts a source (e.g. title says 'X will not play' but source says 'X says playing is my dream').",
    "  - The title contradicts the body (e.g. body says 'X is excited to play' but title says 'X is out').",
    "  - The title combines two unrelated subjects into one claim (e.g. 'X and Y are injured' when only Y is injured).",
    "  - The title states as fact something that is only speculation/opinion in the body.",
    "  - The title reproduces or closely paraphrases a source's HEADLINE instead of being an original headline (compare the wording against the source titles in the context — sharing the facts is required, sharing the phrasing is plagiarism).",
    "",
    "## STEP 2 — BODY FACT-CHECK",
    "",
    `REJECT if the body contains a SPECIFIC claim about an already-occurred event (${fabricationProneFacts})`,
    "that is NOT supported by any source in the verified context.",
    "Opinion, analysis, historical references, and previews of upcoming events are ALLOWED.",
    "",
    "## STEP 2.5 — BRAND GUARDRAIL (mandatory)",
    "",
    `We are ${brandName}, an independent non-profit outlet with our own editorial voice. A source can INFORM an article, but the article must never be ABOUT another outlet or republish its work. REJECT if ANY of these is true:`,
    "  - The title or article names/credits another media outlet as its subject or as the authority for a claim (e.g. 'según Infobae', 'el informe de Perfil').",
    "  - The article's CONTENT is another outlet's list, ranking or compilation, reproduced or attributed.",
    "  - The piece reads as coverage of what another media said/published rather than of the underlying fact itself.",
    "  - It reads as promotional copy for a company, brand, shop or product rather than as journalism.",
    `Reword to report the underlying fact in ${brandName}'s own voice with no outlet name; if the story has no substance once the outlet is removed, REJECT it.`,
    "NOTE: an official source is NOT a rival outlet. Citing the Boletín Oficial, a law, a court ruling, a regulator (ARICCAME, ANMAT) or a peer-reviewed journal is REQUIRED, not a violation.",
    "",
    "## STEP 3 — REFINE (only if everything passes)",
    "",
    "Apply the editorial guidelines. Improve clarity, voice, and structure. Keep all facts accurate.",
    "You MAY rewrite the title to be safer/more literal if the current one is borderline — but never by drifting closer to a source headline's wording, and you should still REJECT if it's actually wrong.",
    "",
    "## Output",
    `Return STRICT JSON with one of these two schemas:`,
    `- Approved: { "rejected": false, "title": string, "excerpt": string, "content": string (HTML allowed) }`,
    `- Rejected: { "rejected": true, "reason": string (in Spanish, cite the specific title-claim that fails and which source contradicts it OR confirms no source mentions it) }`,
    "",
    "## Editorial guidelines:",
    directorInstructions,
    "",
    "## Verified news context (last 24h):",
    newsContext || "(empty — be especially strict: reject anything that asserts a recent event as fact)",
  ].join("\n");

  const userPrompt = `Review this draft and return only the JSON.\n\n${JSON.stringify(draft, null, 2)}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  if (parsed.rejected === true) {
    return { rejected: true, reason: String(parsed.reason ?? "No reason provided") };
  }

  if (!parsed.title || !parsed.content) {
    throw new Error("Director response missing required fields");
  }

  return {
    rejected: false,
    title: String(parsed.title).trim(),
    excerpt: String(parsed.excerpt ?? "").trim(),
    content: String(parsed.content).trim(),
  };
}

export type TranslatedPost = GeneratedPost & { slug: string };

export async function translatePost(
  client: OpenAI,
  model: string,
  source: GeneratedPost,
): Promise<TranslatedPost> {
  const systemPrompt = [
    "You are an editorial translator for a non-profit info portal covering ethnobotany, cannabis and hemp, drug policy, health and the environment. Translate the article below from Spanish to English.",
    "",
    "## Rules",
    "- Preserve the Markdown structure EXACTLY: same headings (##), blockquotes, bold, italics, lists, links. Translate only the text inside them.",
    "- Do NOT translate proper nouns: organisation names, institutions and programmes (e.g. 'REPROCANN', 'ARICCAME', 'Boletín Oficial'), law and decree names, place names. Keep botanical binomials in Latin (Cannabis sativa).",
    "- Keep all numbers, dates, article/law numbers and statistics exactly as they are.",
    "- Write natural, idiomatic editorial English — not a literal word-for-word translation.",
    "- Do not add, remove or reorder information.",
    "",
    "## Output",
    'Return STRICT JSON: { "title": string, "excerpt": string, "content": string (Markdown), "slug": string (URL slug in English, lowercase kebab-case derived from the translated title) }',
  ].join("\n");

  const userPrompt = `Translate this article and return only the JSON.\n\n${JSON.stringify(source, null, 2)}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  if (!parsed.title || !parsed.content) {
    throw new Error("Translator response missing required fields (title, content)");
  }

  return {
    title: String(parsed.title).trim(),
    excerpt: String(parsed.excerpt ?? "").trim(),
    content: String(parsed.content).trim(),
    slug: String(parsed.slug ?? "").trim(),
  };
}
