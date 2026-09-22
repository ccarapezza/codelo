// Los tipos de las tarjetas que un proyecto puede sumar a las pantallas de
// configuración (admin/verticals.ts → `promptCards` y `settingCards`).
//
// Existen porque las pantallas del motor pasaron a ser declarativas: en vez de
// tener las tarjetas escritas en el JSX, las recorren. Así un proyecto puede
// agregar las suyas —el prompt de su lector de normas, el modelo con el que lo
// lee— sin editar un archivo del motor, que es lo que hasta ahora obligaba a
// meter una tarjeta de un vertical dentro del panel de todos.
//
// Una tarjeta nueva necesita además el atributo en el schema.json del single
// type y la clave en la costura del servidor (`verticals/prompt-fields.ts` o
// `verticals/setting-fields.ts`). Sin eso el controller la descarta.

import type * as React from "react";

/** Los mismos acentos que usa el kit del panel (components/ui). */
export type Accent = "primary" | "warning" | "success" | "danger" | "secondary";

/**
 * En qué idioma se escribe un campo. Es lo que la pantalla tiene que decir sin
 * ambigüedad: mezclar idiomas sin avisar era el motivo principal de confusión.
 *
 *   `prompt` — es una INSTRUCCIÓN para el modelo. Va en inglés: todo el
 *              andamiaje del motor está en inglés y los LLM rinden mejor y
 *              gastan menos ahí. El idioma de SALIDA lo decide `writingLanguage`.
 *   `salida` — es TEXTO LITERAL que se pega en el resultado (un cierre de
 *              caption, los temas de los hashtags). Va en el idioma del sitio.
 *   `fijo`   — ni una cosa ni la otra: un nombre, un handle, dos colores.
 */
export type FieldLang = "prompt" | "salida" | "fijo";

export interface PromptField {
  /** La clave en `prompt-setting`. */
  key: string;
  label: string;
  /** Default: `prompt`, que es el caso de la gran mayoría. */
  lang?: FieldLang;
  hint?: string;
  /** Alto del textarea. Sin esto, se renderiza como input de una línea. */
  rows?: number;
  /**
   * Si está, el campo se renderiza como select en vez de texto libre.
   *
   * Para valores que el prompt interpola literalmente y donde un typo degrada la
   * salida sin dar ningún error: el idioma de escritura es el caso claro.
   */
  options?: Array<{ value: string; label: string }>;
  /**
   * El andamiaje fijo que rodea a este campo, en gris y sin editar. Sirve para
   * que quien escribe el prompt vea dónde cae su texto.
   */
  reference?: string;
}

export interface PromptCard {
  /** También es el ancla de la URL: /admin/prompt-settings#<id>. */
  id: string;
  title: string;
  description: string;
  accent: Accent;
  icon?: React.ReactNode;
  fields: PromptField[];
}

export interface SettingField {
  /** La clave en `site-setting`. */
  key: string;
  label: string;
  hint?: string;
  /** `text-model` y `image-model` reusan los catálogos de modelos del motor. */
  kind: "text" | "toggle" | "text-model" | "image-model";
  placeholder?: string;
}

export interface SettingCard {
  id: string;
  title: string;
  description: string;
  accent: Accent;
  icon?: React.ReactNode;
  fields: SettingField[];
}
