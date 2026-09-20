import { Magic, Cog, Cast, Pencil, Images, Feather, Files } from "@strapi/icons";
import type { StrapiApp } from "@strapi/strapi/admin";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import SocialStudioPanel from "./components/SocialStudioPanel";
import * as verticals from "./verticals";
// Oculta "Marketplace" del menú; ver el comentario del propio archivo para
// por qué no se puede resolver por configuración ni por permisos.
import "./hide-marketplace.css";


// Referencia a la app COMPLETA capturada en register(). La necesitamos en
// bootstrap() para tocar `app.widgets`: la fachada de bootstrap no lo expone,
// pero bootstrap corre DESPUÉS del de los plugins (content-manager), que es
// justo cuando ya están registrados sus widgets y recién ahí se pueden filtrar.
let appRef: StrapiApp | null = null;

// Los widgets que se dejan en la home: los que aporta el vertical. La lista es
// la fuente de verdad para el filtro del bootstrap, en vez de un prefijo en el
// id que hay que acordarse de mantener sincronizado en dos lados (ya se
// desincronizó una vez y la home quedó vacía).
const IDS_PROPIOS = new Set(verticals.widgets.map(w => w.id));

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
    // Logo, paleta y textos de marca del login: todo eso es del proyecto, no
    // del motor, así que viene de la costura.
    ...verticals.adminConfig,
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

    // Rutas propias del vertical, si las hay. Van acá y no en bootstrap por la
    // misma razón que las de arriba: `app.router` sólo existe en register.
    for (const r of verticals.routes) {
      app.router.addRoute({
        path: r.path,
        lazy: async () => ({ Component: (await r.Component()) as never }),
      });
    }

    // ── Home: tarjetas de sistema/crons ──────────────────────────────────
    // Widgets informativos (sólo lectura) para que TODO usuario del panel
    // —admin, editor o author— entienda de dónde y cuándo sale la información.
    // No llevan `permissions`/`roles`, así que son visibles para todos.
    app.widgets.register(verticals.widgets);
  },


  bootstrap(app: StrapiApp) {
    // Home: dejar SÓLO los widgets propios. Va en bootstrap —no en register—
    // a propósito: el content-manager registra sus widgets (last-edited-entries,
    // last-published-entries, chart-entries) en SU bootstrap, y los bootstraps
    // de plugins corren antes que este. Filtrar acá los alcanza; en register no
    // existían todavía. Se usa `appRef` porque la fachada de bootstrap no expone
    // `widgets`. Para dejar además un widget nativo de Strapi, se agrega su id a
    // la allowlist.
    appRef?.widgets.register(prev => prev.filter(w => IDS_PROPIOS.has(String(w.id ?? ""))));

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

    // Entradas de menú propias del vertical, después de las del motor para que
    // queden agrupadas al final del panel.
    for (const link of verticals.menuLinks) app.addMenuLink(link);
  },
};
