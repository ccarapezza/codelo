import {
  Magic,
  Cog,
  Cast,
  Pencil,
  Images,
  Feather,
  Book,
  Cloud,
  Plant,
  Files,
} from "@strapi/icons";
import type { StrapiApp } from "@strapi/strapi/admin";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import SocialStudioPanel from "./components/SocialStudioPanel";
import LogoCodelo from "./assets/logo-codelo.png";
// Oculta "Marketplace" del menú; ver el comentario del propio archivo para
// por qué no se puede resolver por configuración ni por permisos.
import "./hide-marketplace.css";

// Acento naranja "Cogollos del Oeste" en vez del violeta de Strapi, para
// distinguir este panel de otros. La rampa se derivó del naranja del logo
// (atardecer del isotipo) manteniendo la lógica de Strapi: en claro, primary600
// es el tono oscuro de los botones (texto blanco, contraste AA ~4.5:1); en
// oscuro, primary600 es el tono claro que resalta sobre el fondo, y los botones
// usan buttonPrimary600 (el naranja quemado) para no perder contraste.
const COLORS_LIGHT = {
  primary100: "#fdefe0",
  primary200: "#f8d6af",
  primary500: "#de7a22",
  primary600: "#bc5b0d",
  primary700: "#94480a",
  buttonPrimary500: "#de7a22",
  buttonPrimary600: "#bc5b0d",
};
const COLORS_DARK = {
  primary100: "#2a1b0d",
  primary200: "#6b4a28",
  primary500: "#bc5b0d",
  primary600: "#eb9a4e",
  primary700: "#eb9a4e",
  buttonPrimary500: "#de7a22",
  buttonPrimary600: "#bc5b0d",
};

// Referencia a la app COMPLETA capturada en register(). La necesitamos en
// bootstrap() para tocar `app.widgets`: la fachada de bootstrap no lo expone,
// pero bootstrap corre DESPUÉS del de los plugins (content-manager), que es
// justo cuando ya están registrados sus widgets y recién ahí se pueden filtrar.
let appRef: StrapiApp | null = null;

// Apaga el guided tour de Strapi ("Discover your application" + los tooltips
// paso a paso). No hay flag de config: `isGuidedTourEnabled` está hardcodeado a
// `NODE_ENV !== 'test'`, y sólo lo ve el primer super admin. El tour guarda su
// estado en localStorage["STRAPI_GUIDED_TOUR"]; lo pre-seteamos como
// desactivado y con todas las tours completadas ANTES de que monte el provider,
// que es cuando lee esa clave. Merge (no reemplazo) para preservar tours que
// una versión futura de Strapi pudiera agregar. Todo en try/catch: si algo
// falla, se ignora — nunca debe romper el arranque del panel.
function disableGuidedTour(): void {
  try {
    const KEY = "STRAPI_GUIDED_TOUR";
    const KNOWN = ["contentTypeBuilder", "contentManager", "apiTokens", "strapiCloud"];
    let cur: { tours?: Record<string, unknown>; completedActions?: unknown[] } = {};
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) cur = JSON.parse(raw);
    } catch {
      /* localStorage con basura: lo reescribimos limpio */
    }
    const tours: Record<string, { currentStep: number; isCompleted: boolean }> = {};
    for (const name of [...KNOWN, ...Object.keys(cur.tours ?? {})]) {
      tours[name] = { currentStep: 0, isCompleted: true };
    }
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        tours,
        enabled: false,
        hidden: true,
        completedActions: cur.completedActions ?? [],
      }),
    );
  } catch {
    /* no-op */
  }
}

export default {
  config: {
    // Logo de Cogollos del Oeste en login y en el menú lateral.
    auth: { logo: LogoCodelo },
    menu: { logo: LogoCodelo },
    // Acento naranja de marca (ver COLORS_LIGHT/DARK arriba).
    theme: {
      light: { colors: COLORS_LIGHT },
      dark: { colors: COLORS_DARK },
    },
    // Textos de marca en la pantalla de login (sobreescriben las claves i18n
    // de Strapi). Se ponen en en+es para que aparezcan sea cual sea el idioma
    // del panel.
    translations: {
      en: {
        "Auth.form.welcome.title": "Bienvenido a Cogollos del Oeste",
        "Auth.form.welcome.subtitle": "Panel de gestión del portal",
      },
      es: {
        "Auth.form.welcome.title": "Bienvenido a Cogollos del Oeste",
        "Auth.form.welcome.subtitle": "Panel de gestión del portal",
      },
    },
    // Menos ruido: saca los videos tutoriales del menú de ayuda y el aviso de
    // "nueva versión de Strapi". (El guided tour de la home se apaga aparte, en
    // register() → disableGuidedTour; `tutorials:false` NO lo cubre.)
    tutorials: false,
    notifications: { releases: false },
  },

  // ⚠️ `register` y `bootstrap` NO reciben lo mismo, aunque los tipemos igual:
  // a `register` Strapi le pasa la instancia entera de StrapiApp, y a `bootstrap`
  // una fachada con sólo ocho métodos (addMenuLink, getPlugin, registerHook…).
  // `app.router` existe únicamente acá; llamarlo desde bootstrap tira
  // "Cannot read properties of undefined (reading 'addRoute')" y deja el panel
  // en blanco. El tipo StrapiApp no lo refleja, así que el typecheck pasa igual.
  register(app: StrapiApp) {
    appRef = app;
    disableGuidedTour();
    // Audit IA no tiene entrada propia en el menú: se entra por el botón
    // "Audit" del header de AI Agents, que es el contexto donde tiene sentido
    // (audita lo que hacen esos agentes). La ruta se registra igual para que
    // /admin/audit siga siendo linkeable y sobreviva al back del navegador.
    //
    // `addRoute` es la misma vía que usa addMenuLink por dentro: empuja un
    // RouteObject hijo del layout autenticado, y por eso el path va sin barra
    // inicial y con `/*` (addMenuLink hace ese mismo normalizado con el `to`).
    app.router.addRoute({
      path: "audit/*",
      lazy: async () => {
        const { default: Component } = await import("./pages/AuditPage");
        return { Component };
      },
    });

    // Editor unificado de notas (crear a mano / con IA / editar). No lleva
    // entrada de menú: se entra desde /admin/notas. `?id=` = edición; sin él,
    // creación. Se registra con addRoute (como Audit) para que sea navegable y
    // sobreviva al back del navegador.
    app.router.addRoute({
      path: "editor-nota/*",
      lazy: async () => {
        const { default: Component } = await import("./pages/NoteEditorPage");
        return { Component };
      },
    });

    // ── Home: tarjetas de sistema/crons ──────────────────────────────────
    // Widgets informativos (sólo lectura) para que TODO usuario del panel
    // —admin, editor o author— entienda de dónde y cuándo sale la información.
    // No llevan `permissions`/`roles`, así que son visibles para todos.
    app.widgets.register([
      {
        icon: Book,
        title: { id: "codelo.widget.boletin", defaultMessage: "Boletín Oficial" },
        id: "codelo-boletin",
        component: async () => (await import("./components/widgets/BoletinWidget")).default,
      },
      {
        icon: Cloud,
        title: {
          id: "codelo.widget.termohigrometro",
          defaultMessage: "Termohigrómetro (clima de cultivo)",
        },
        id: "codelo-termohigrometro",
        component: async () => (await import("./components/widgets/TermohigrometroWidget")).default,
      },
      {
        icon: Plant,
        title: { id: "codelo.widget.inase", defaultMessage: "INASE — cultivares y operadores" },
        id: "codelo-inase",
        component: async () => (await import("./components/widgets/InaseWidget")).default,
      },
    ]);
  },

  bootstrap(app: StrapiApp) {
    // Home: dejar SÓLO los widgets de codelo. Va en bootstrap —no en register—
    // a propósito: el content-manager registra sus widgets (last-edited-entries,
    // last-published-entries, chart-entries) en SU bootstrap, y los bootstraps
    // de plugins corren antes que este. Filtrar acá los alcanza; en register no
    // existían todavía. Se usa `appRef` porque la fachada de bootstrap no expone
    // `widgets`. Si más adelante se quiere un widget nativo de Strapi en la home,
    // se lo agrega a esta allowlist por prefijo.
    appRef?.widgets.register(prev => prev.filter(w => String(w.id ?? "").startsWith("codelo-")));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app.getPlugin("content-manager") as any).apis.addEditViewSidePanel([SocialStudioPanel]);

    app.addMenuLink({
      to: "/social-studio",
      icon: Images,
      intlLabel: {
        id: "social-studio.plugin.name",
        defaultMessage: "Social Studio",
      },
      permissions: [],
      Component: () => import("./pages/SocialStudioPage"),
    });

    app.addMenuLink({
      to: "/ai-agents",
      icon: Magic,
      intlLabel: {
        id: "ai-agents.plugin.name",
        defaultMessage: "AI Agents",
      },
      permissions: [],
      Component: () => import("./pages/AgentsPage"),
    });

    app.addMenuLink({
      to: "/news-generator",
      icon: Feather,
      intlLabel: {
        id: "news-generator.plugin.name",
        defaultMessage: "Generador de notas",
      },
      permissions: [],
      Component: () => import("./pages/NewsGeneratorPage"),
    });

    // Vista simple para verificar/publicar notas (el Content Manager queda para
    // editarlas). Visible para todos los usuarios del panel.
    app.addMenuLink({
      to: "/notas",
      icon: Files,
      intlLabel: {
        id: "notas.plugin.name",
        defaultMessage: "Notas",
      },
      permissions: [],
      Component: () => import("./pages/PostReviewPage"),
    });

    // `permissions: []` = visible para cualquier admin logueado (Strapi lo
    // interpreta como "sin restricción"). Estas dos pantallas van con una acción
    // RBAC propia, así que sólo las ve el super admin — o el rol al que se la
    // hayan concedido. La página además se protege sola con Page.Protect, porque
    // ocultar el link del menú no bloquea entrar por URL.
    app.addMenuLink({
      to: "/site-settings",
      icon: Cog,
      intlLabel: {
        id: "site-settings.plugin.name",
        defaultMessage: "Site Settings",
      },
      permissions: [{ action: ADMIN_PERMISSIONS.siteSettings, subject: null }],
      Component: () => import("./pages/SettingsPage"),
    });

    app.addMenuLink({
      to: "/prompt-settings",
      icon: Pencil,
      intlLabel: {
        id: "prompt-settings.plugin.name",
        defaultMessage: "Prompts IA",
      },
      permissions: [{ action: ADMIN_PERMISSIONS.promptSettings, subject: null }],
      Component: () => import("./pages/PromptSettingsPage"),
    });

    app.addMenuLink({
      to: "/rss-feeds",
      icon: Cast,
      intlLabel: {
        id: "rss-feeds.plugin.name",
        defaultMessage: "Fuentes RSS",
      },
      permissions: [],
      Component: () => import("./pages/RssFeedsPage"),
    });
  },
};
