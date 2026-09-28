/**
 * Shared admin UI kit (built on @strapi/design-system).
 *
 * Goal: one consistent shell across every custom admin page — same header,
 * cards, dividers, empty/loading states and save bar — so the pages read as a
 * single product instead of N separate experiments.
 *
 * Hard rule: colors come from Strapi theme TOKENS (neutralN, primaryN, …), never
 * hardcoded hex — that's what keeps light/dark mode correct. No Tailwind here:
 * the admin is Strapi DS + styled-components.
 */
import * as React from "react";
import { Box, Flex, Typography, Button } from "@strapi/design-system";
import { Check } from "@strapi/icons";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useT } from "../../i18n";

export type Accent = "primary" | "warning" | "success" | "danger" | "secondary";

const ACCENT: Record<Accent, { strip: string; chipBg: string; chipFg: string }> = {
  primary: { strip: "primary500", chipBg: "primary100", chipFg: "primary600" },
  warning: { strip: "warning500", chipBg: "warning100", chipFg: "warning600" },
  success: { strip: "success500", chipBg: "success100", chipFg: "success600" },
  danger: { strip: "danger500", chipBg: "danger100", chipFg: "danger600" },
  secondary: { strip: "secondary500", chipBg: "secondary100", chipFg: "secondary600" },
};

/** Page outer wrapper: neutral canvas + standard padding. Every page uses this. */
export function PageContainer({ children }: { children: React.ReactNode }) {
  // Columna flex a alto de viewport: es lo que le permite a la SaveBar irse al
  // fondo cuando el contenido es corto. `position: sticky` sola no alcanza —
  // sólo pega el elemento mientras hay scroll, así que en una pantalla con pocos
  // campos la barra quedaba flotando a media altura con espacio vacío debajo.
  return (
    <Box
      padding={8}
      background="neutral100"
      minHeight="100vh"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {children}
    </Box>
  );
}

/** Square token-colored icon chip (used by the header and the cards). */
export function IconChip({
  icon,
  accent = "primary",
  size = 40,
}: {
  icon: React.ReactNode;
  accent?: Accent;
  size?: number;
}) {
  const a = ACCENT[accent];
  return (
    <Box
      background={a.chipBg}
      borderRadius="8px"
      hasRadius
      style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <Typography textColor={a.chipFg}>{icon}</Typography>
    </Box>
  );
}

/** Consistent page header: icon chip + title + subtitle, optional right actions. */
export function PageHeader({
  icon,
  title,
  subtitle,
  accent = "primary",
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent?: Accent;
  actions?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  // En mobile el header pasa a columna: icono+título arriba y las acciones
  // debajo, a lo ancho. En fila (como estaba) el subtítulo se espachurraba a una
  // palabra por línea y los botones se cortaban.
  return (
    <Flex
      direction={isMobile ? "column" : "row"}
      justifyContent="space-between"
      alignItems={isMobile ? "stretch" : "center"}
      gap={isMobile ? 3 : 4}
      marginBottom={6}
    >
      <Flex gap={3} alignItems="center">
        <IconChip icon={icon} accent={accent} size={44} />
        <Box style={{ minWidth: 0 }}>
          <Typography variant="alpha" textColor="neutral800">
            {title}
          </Typography>
          {subtitle ? (
            <Box marginTop={1}>
              <Typography variant="epsilon" textColor="neutral500">
                {subtitle}
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Flex>
      {actions ? (
        // `flexShrink: 0` + `nowrap`: con un subtítulo largo, el bloque del
        // título se comía el ancho de las acciones y la etiqueta de un botón se
        // partía en dos líneas, dejándolo más alto que sus vecinos. Si de verdad
        // no entran, el `wrap` los baja de línea enteros en vez de espachurrarlos.
        <Flex
          gap={2}
          wrap="wrap"
          alignItems="center"
          justifyContent={isMobile ? "flex-start" : "flex-end"}
          style={{ flexShrink: 0, whiteSpace: "nowrap" }}
        >
          {actions}
        </Flex>
      ) : null}
    </Flex>
  );
}

/** Hairline divider that respects the theme (token, not hardcoded hex). */
/**
 * Referencia gris de un texto FIJO que rodea a un campo editable.
 *
 * Sirve para que quien escribe un prompt vea dónde cae lo suyo dentro del
 * andamiaje que no se puede tocar. Vivía dentro de PromptSettingsPage, así que
 * una tarjeta aportada por un proyecto no podía usarlo.
 */
export function ReferenceNote({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <Box
      marginTop={2}
      padding={3}
      background="neutral100"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      borderRadius="4px"
      hasRadius
    >
      <Typography variant="pi" textColor="neutral500" fontWeight="bold">{t("ui.textoFijo")}</Typography>
      <Box marginTop={1}>
        <Typography variant="pi" textColor="neutral500" style={{ whiteSpace: "pre-wrap" }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

export function Hairline({ marginY }: { marginY?: number }) {
  return <Box background="neutral150" marginTop={marginY} marginBottom={marginY} style={{ height: 1 }} />;
}

/** Small uppercase label to group related fields/sections inside a card. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="sigma" textColor="neutral600">
      {children}
    </Typography>
  );
}

/** Card with a colored accent strip, icon chip header and optional actions. */
export function AccentCard({
  icon,
  title,
  description,
  accent = "primary",
  actions,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  accent?: Accent;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const a = ACCENT[accent];
  return (
    <Box
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      borderRadius="8px"
      hasRadius
      shadow="filterShadow"
      // ⚠️ Sin `height: 100%`, y es deliberado: ese porcentaje se resuelve
      // contra la altura de la FILA de la grilla, o sea contra la tarjeta más
      // alta, así que ANULA el `align-items: start` del contenedor. Con él,
      // «Publicación» —que es un toggle— medía lo mismo que «Modelos de IA» y
      // arrastraba 332px de aire.
      //
      // Cuando se QUIERAN parejas, el contenedor lo pide con `align-items:
      // stretch`, que es el default de grid y no necesita esto.
      style={{ display: "flex", overflow: "hidden" }}
    >
      <Box background={a.strip} style={{ width: 4, flexShrink: 0 }} />
      <Box style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box padding={5}>
          <Flex justifyContent="space-between" alignItems="flex-start" gap={3}>
            <Flex gap={3} alignItems="center">
              {icon ? <IconChip icon={icon} accent={accent} /> : null}
              <Typography variant="delta" textColor="neutral800">
                {title}
              </Typography>
            </Flex>
            {actions ? <Flex gap={2}>{actions}</Flex> : null}
          </Flex>
          {description ? (
            <Box marginTop={3}>
              <Typography variant="pi" textColor="neutral600">
                {description}
              </Typography>
            </Box>
          ) : null}
        </Box>
        <Hairline />
        <Box padding={5} style={{ flex: 1 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

/** Centered empty state for lists with no content yet. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Flex direction="column" alignItems="center" justifyContent="center" gap={3} padding={8}>
      {icon ? <IconChip icon={icon} accent="primary" size={56} /> : null}
      <Typography variant="delta" textColor="neutral700">
        {title}
      </Typography>
      {description ? (
        <Box maxWidth="32rem">
          <Typography variant="omega" textColor="neutral500" textAlign="center">
            {description}
          </Typography>
        </Box>
      ) : null}
      {action ? <Box marginTop={2}>{action}</Box> : null}
    </Flex>
  );
}

/**
 * Sticky save bar with unsaved-changes awareness + ⌘/Ctrl+S shortcut.
 * Place as the last child of a PageContainer (assumes parent padding={8} = 40px,
 * which the negative margins cancel so the bar spans edge-to-edge).
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel,
  edgeOffset = 40,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  edgeOffset?: number;
}) {
  const t = useT();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, onSave]);

  return (
    // Envoltorio con una franja del color de la PÁGINA arriba de la barra.
    //
    // Es el aire entre la última tarjeta y la barra. No alcanza con un
    // `marginTop` en la barra: `marginTop: auto` es lo que la empuja al fondo
    // cuando el contenido es corto, y con contenido largo `auto` resuelve a 0 —
    // o sea que justo cuando hay scroll, que es cuando se nota, el aire
    // desaparecía y la tarjeta quedaba pegada al borde.
    //
    // La franja va DENTRO del elemento sticky para que viaje con él: es lo que
    // tapa el contenido que pasa por debajo mientras se scrollea, en vez de
    // dejarlo asomar contra la barra.
    <Box
      position="sticky"
      bottom={0}
      paddingTop={5}
      background="neutral100"
      style={{
        marginTop: "auto",
        marginLeft: -edgeOffset,
        marginRight: -edgeOffset,
        marginBottom: -edgeOffset,
      }}
    >
    <Box
      paddingTop={4}
      paddingBottom={4}
      paddingLeft={8}
      paddingRight={8}
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px 0 0 0"
      borderStyle="solid"
    >
      <Flex justifyContent="space-between" alignItems="center" gap={4}>
        {dirty ? (
          <Flex gap={2} alignItems="center">
            <Box background="warning500" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
            <Typography variant="pi" textColor="neutral600">
              {t("ui.sinGuardar")} · <Typography variant="pi" textColor="neutral500">⌘S / Ctrl+S</Typography>
            </Typography>
          </Flex>
        ) : (
          <Flex gap={1} alignItems="center">
            <Typography textColor="success600"><Check width="0.9rem" height="0.9rem" /></Typography>
            <Typography variant="pi" textColor="neutral500">{t("ui.todoGuardado")}</Typography>
          </Flex>
        )}
        <Flex gap={2}>
          {onDiscard ? (
            <Button variant="tertiary" onClick={onDiscard} disabled={!dirty || saving} size="L">
              {t("ui.descartar")}
            </Button>
          ) : null}
          <Button onClick={onSave} loading={saving} disabled={!dirty} size="L">
            {saveLabel ?? t("nota.guardarCambios")}
          </Button>
        </Flex>
      </Flex>
    </Box>
    </Box>
  );
}
