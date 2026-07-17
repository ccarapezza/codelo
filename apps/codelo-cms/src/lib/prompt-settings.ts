// Loads the vertical-level prompt customization from the `prompt-setting` single
// type, falling back field-by-field to DEFAULT_PROMPT_SETTINGS. Mirrors the
// readSettingModel() pattern in openai-config.ts: a missing row, an empty field,
// or an unavailable DB all resolve to the hardcoded defaults — so behavior is
// unchanged until an admin saves the Prompts page.

import { DEFAULT_PROMPT_SETTINGS, type PromptSettings } from "./prompt-defaults";

type StrapiLike = {
  db: {
    query: (uid: string) => {
      findOne: (params: object) => Promise<Record<string, unknown> | null>;
    };
  };
};

export async function getPromptSettings(strapi: StrapiLike): Promise<PromptSettings> {
  let row: Record<string, unknown> | null = null;
  try {
    row = await strapi.db.query("api::prompt-setting.prompt-setting").findOne({});
  } catch {
    // No row yet / DB unavailable → fall back to defaults for every field.
    row = null;
  }

  const pick = (key: keyof PromptSettings): string => {
    const value = (row?.[key] as string | undefined)?.trim();
    return value && value.length > 0 ? value : DEFAULT_PROMPT_SETTINGS[key];
  };

  return {
    domainDescription: pick("domainDescription"),
    writingLanguage: pick("writingLanguage"),
    fabricationProneFacts: pick("fabricationProneFacts"),
    analysisModeFraming: pick("analysisModeFraming"),
    bodyStructureGuide: pick("bodyStructureGuide"),
    analystSystemInstructions: pick("analystSystemInstructions"),
    analystBodyStructure: pick("analystBodyStructure"),
    imageSystemInstructions: pick("imageSystemInstructions"),
    imageThemeGuide: pick("imageThemeGuide"),
    imageAnchorTaxonomy: pick("imageAnchorTaxonomy"),
  };
}
