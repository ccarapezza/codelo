// Identidad visual: los colores y el logo con los que se dibujan las placas.
//
// Vive en Sitio e integraciones y no en el asistente editorial porque no lo lee
// ningún agente: un hex no tiene idioma que declarar ni se interpola en ningún
// prompt. Lo consume el renderer (lib/social-cards).
//
// La VISTA PREVIA no es adorno: es lo que vuelve seguro un selector de color.
// Los colores se eligen de a uno y el error no está en ninguno de ellos sino en
// la combinación —un titular que desaparece sobre su fondo, un acento que no se
// despega—, así que el único momento en que se puede ver el problema es
// mientras se elige. Es una maqueta en HTML y no un render de satori a
// propósito: responde mientras se arrastra el selector, y para "¿se lee?" una
// aproximación fiel del layout alcanza.

import * as React from "react";
import { Box, Button, Field, Flex, TextInput, Typography } from "@strapi/design-system";
import { Upload } from "@strapi/icons";
import { GroupLabel, Hairline } from "../../components/ui";

/** Los colores, en el orden en que se leen sobre la placa: fondo, textos, acentos. */
export const BRAND_FIELDS = [
  { key: "brandBg", label: "Fondo", hint: "El fondo de la placa cuando no hay imagen. También tiñe el velo sobre las fotos." },
  { key: "brandTitle", label: "Titulares", hint: "El texto más grande y de mayor contraste." },
  { key: "brandBody", label: "Cuerpo", hint: "Bajadas, citas y texto corrido." },
  { key: "brandMuted", label: "Pie", hint: "La firma, la atribución y las etiquetas." },
  { key: "brandAccent", label: "Acento", hint: "El color de marca. Centro del degradé." },
  { key: "brandAccentLight", label: "Acento claro", hint: "Todo acento que sea texto: los números grandes, la comilla, la url." },
  { key: "brandAccentDeep", label: "Acento profundo", hint: "El cierre del degradé y los velos de color. Nunca lleva texto encima, así que puede ser oscuro." },
] as const;

export const BRAND_KEYS = BRAND_FIELDS.map((f) => f.key);

const HEX = /^#[0-9a-fA-F]{6}$/;

// ── contraste ──────────────────────────────────────────────────────────────
// El mismo cálculo que usa la WCAG. Está acá y no importado del motor porque
// este archivo se compila para el navegador y el del motor arrastra Node.

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 21;
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Los pares que tienen que leerse sobre la placa.
 *
 * El umbral no es el 4.5 de la WCAG para todos: el titular se dibuja a 96px y
 * el pie a 30px, y la norma misma admite 3:1 para texto grande. Pedir 4.5 en el
 * titular marcaría en rojo combinaciones que se leen perfecto.
 */
const PARES = [
  { de: "brandTitle", sobre: "brandBg", que: "Titulares sobre el fondo", minimo: 3 },
  { de: "brandBody", sobre: "brandBg", que: "Cuerpo sobre el fondo", minimo: 4.5 },
  { de: "brandMuted", sobre: "brandBg", que: "Pie sobre el fondo", minimo: 4.5 },
  { de: "brandAccentLight", sobre: "brandBg", que: "Destacados sobre el fondo", minimo: 3 },
] as const;

export interface AvisoContraste {
  que: string;
  valor: number;
  minimo: number;
}

export function avisosDeContraste(v: Record<string, string>): AvisoContraste[] {
  return PARES.map((p) => ({
    que: p.que,
    valor: contraste(v[p.de] ?? "", v[p.sobre] ?? ""),
    minimo: p.minimo,
  })).filter((a) => a.valor < a.minimo);
}

// ── el campo ───────────────────────────────────────────────────────────────

function ColorField({
  label,
  hint,
  valor,
  onChange,
}: {
  label: string;
  hint: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  const valido = HEX.test(valor);
  return (
    <Field.Root hint={hint} error={valor && !valido ? "Tiene que ser un hex de seis dígitos, como #1F4E63." : undefined}>
      <Field.Label>{label}</Field.Label>
      <Flex gap={2} alignItems="center">
        {/*
          El selector nativo y el texto editan lo mismo. Los dos hacen falta: el
          selector para elegir mirando, el texto para pegar un hex exacto de una
          guía de marca — que es como llega un color en la vida real.
        */}
        <input
          type="color"
          aria-label={`${label}: elegir color`}
          value={valido ? valor : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{
            width: 40,
            height: 36,
            padding: 2,
            border: "1px solid var(--nib-borde, rgba(128,128,128,0.4))",
            borderRadius: 4,
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <TextInput
          aria-label={label}
          value={valor}
          placeholder="#000000"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.toUpperCase())}
        />
      </Flex>
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  );
}

// ── la vista previa ────────────────────────────────────────────────────────

/** Una placa de mentira, con la estructura de la real: barra, volanta, titular, bajada, pie. */
function PlacaPreview({
  v,
  logoUrl,
  handle,
}: {
  v: Record<string, string>;
  logoUrl: string | null;
  handle: string;
}) {
  const c = (k: string, fallback: string) => (HEX.test(v[k] ?? "") ? v[k] : fallback);
  const bg = c("brandBg", "#0E1A1C");
  const degrade = `linear-gradient(95deg, ${c("brandAccentLight", "#6FE0D4")} 0%, ${c(
    "brandAccent",
    "#2BAFA3",
  )} 55%, ${c("brandAccentDeep", "#1F4E63")} 100%)`;

  return (
    <Box
      style={{
        width: "100%",
        maxWidth: 260,
        aspectRatio: "4 / 5",
        background: bg,
        borderRadius: 6,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ height: 6, background: degrade, flexShrink: 0 }} />
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: c("brandMuted", "#8AA0A1"),
            fontWeight: 600,
          }}
        >
          Volanta
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 26,
            lineHeight: 1.05,
            fontWeight: 800,
            color: c("brandTitle", "#FFFFFF"),
            textTransform: "uppercase",
          }}
        >
          Un titular de ejemplo
        </div>
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.4, color: c("brandBody", "#E6EDEC") }}>
          La bajada va en el color de cuerpo, que es el que más texto lleva.
        </div>
        <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: c("brandAccentLight", "#6FE0D4") }}>
          128
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ height: 18, maxWidth: 60, objectFit: "contain" }} />
          ) : (
            <div style={{ height: 18, width: 18, borderRadius: 4, background: degrade }} />
          )}
          <div style={{ fontSize: 10, fontWeight: 600, color: c("brandMuted", "#8AA0A1") }}>
            {handle ? `@${handle}` : "sin firma"}
          </div>
        </div>
      </div>
    </Box>
  );
}

// ── la tarjeta ─────────────────────────────────────────────────────────────

export function BrandFields({
  valores,
  onChange,
  logoUrl,
  handle,
  onSubirLogo,
  onQuitarLogo,
  subiendo,
}: {
  valores: Record<string, string>;
  onChange: (key: string, v: string) => void;
  logoUrl: string | null;
  handle: string;
  onSubirLogo: (f: File) => void;
  onQuitarLogo: () => void;
  subiendo: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const avisos = avisosDeContraste(valores);

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Flex gap={6} alignItems="flex-start" wrap="wrap">
        <Box style={{ flex: "1 1 460px", minWidth: 280 }}>
          {/* Los colores se acomodan de a dos o tres según el ancho: en una sola
              columna, siete campos con su ayuda son una tira muy larga. */}
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 16,
            }}
          >
            {BRAND_FIELDS.map((f) => (
              <ColorField
                key={f.key}
                label={f.label}
                hint={f.hint}
                valor={valores[f.key] ?? ""}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </Box>
        </Box>

        <Box style={{ flex: "0 0 260px" }}>
          <Flex direction="column" alignItems="stretch" gap={3}>
            <GroupLabel>Vista previa</GroupLabel>
            <PlacaPreview v={valores} logoUrl={logoUrl} handle={handle} />
            <Typography variant="pi" textColor="neutral600">
              Una placa de ejemplo con estos colores. El @usuario sale de Configuración editorial.
            </Typography>

            {avisos.length > 0 && (
              <Box
                padding={3}
                background="warning100"
                hasRadius
                borderColor="warning200"
                borderWidth="1px"
                borderStyle="solid"
              >
                <Typography variant="pi" fontWeight="bold" textColor="warning700">
                  Cuesta leerlo
                </Typography>
                {avisos.map((a) => (
                  <Box key={a.que} paddingTop={1}>
                    <Typography variant="pi" textColor="warning700">
                      {a.que}: {a.valor.toFixed(1)}:1, por debajo de {a.minimo}:1.
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Flex>
        </Box>
      </Flex>

      <Hairline />

      <Field.Root hint="PNG con fondo transparente. Se imprime al pie de cada placa y grande en la de cierre. Sin esto se usa el del motor.">
        <Field.Label>Logo de las placas</Field.Label>
        <Flex gap={2} alignItems="center" paddingTop={1}>
          <Button
            variant="tertiary"
            startIcon={<Upload />}
            loading={subiendo}
            onClick={() => fileRef.current?.click()}
          >
            {logoUrl ? "Cambiar el logo" : "Subir un logo"}
          </Button>
          {logoUrl && (
            <Button variant="tertiary" onClick={onQuitarLogo}>
              Usar el del motor
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSubirLogo(f);
              e.target.value = "";
            }}
          />
        </Flex>
        <Field.Hint />
      </Field.Root>
    </Flex>
  );
}
