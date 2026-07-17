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
  return (
    <Box padding={8} background="neutral100" minHeight="100vh">
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
  return (
    <Flex justifyContent="space-between" alignItems="center" gap={4} marginBottom={6}>
      <Flex gap={3} alignItems="center">
        <IconChip icon={icon} accent={accent} size={44} />
        <Box>
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
      {actions ? <Flex gap={2}>{actions}</Flex> : null}
    </Flex>
  );
}

/** Hairline divider that respects the theme (token, not hardcoded hex). */
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
      style={{ display: "flex", overflow: "hidden", height: "100%" }}
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
  saveLabel = "Guardar cambios",
  edgeOffset = 40,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  edgeOffset?: number;
}) {
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
    <Box
      position="sticky"
      bottom={0}
      marginTop={6}
      paddingTop={4}
      paddingBottom={4}
      paddingLeft={8}
      paddingRight={8}
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px 0 0 0"
      borderStyle="solid"
      style={{ marginLeft: -edgeOffset, marginRight: -edgeOffset, marginBottom: -edgeOffset }}
    >
      <Flex justifyContent="space-between" alignItems="center" gap={4}>
        {dirty ? (
          <Flex gap={2} alignItems="center">
            <Box background="warning500" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
            <Typography variant="pi" textColor="neutral600">
              Cambios sin guardar · <Typography variant="pi" textColor="neutral500">⌘S / Ctrl+S</Typography>
            </Typography>
          </Flex>
        ) : (
          <Flex gap={1} alignItems="center">
            <Typography textColor="success600"><Check width="0.9rem" height="0.9rem" /></Typography>
            <Typography variant="pi" textColor="neutral500">Todo guardado</Typography>
          </Flex>
        )}
        <Flex gap={2}>
          {onDiscard ? (
            <Button variant="tertiary" onClick={onDiscard} disabled={!dirty || saving} size="L">
              Descartar
            </Button>
          ) : null}
          <Button onClick={onSave} loading={saving} disabled={!dirty} size="L">
            {saveLabel}
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
