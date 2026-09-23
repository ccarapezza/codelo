// ⚠️ Los iconos NO pueden repetir los del nav de Strapi, que está en la misma
// columna: Content Manager usa Feather, Media Library usa Images,
// Content-Type Builder usa Layout, Home usa House y Settings usa Cog. Dos
// iconos iguales a dos pantallas distintas es la confusión que este reacomodo
// viene a sacar, no una a agregar.
import {
  BulletList,
  Cast,
  Command,
  Magic,
  PaintBrush,
  SlidersHorizontal,
} from "@strapi/icons";
import type { StrapiApp } from "@strapi/strapi/admin";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import SocialStudioPanel from "./components/SocialStudioPanel";
import { DEFAULT_ADMIN_CONFIG } from "./default-brand";
import { injectAdminStyles } from "./inject-styles";
import * as verticals from "./verticals";


// Referencia a la app COMPLETA capturada en register(). La necesitamos en
// bootstrap() para tocar `app.widgets`: la fachada de bootstrap no lo expone,
// pero bootstrap corre DESPUÉS del de los plugins (content-manager), que es
// justo cuando ya están registrados sus widgets y recién ahí se pueden filtrar.
let appRef: StrapiApp | null = null;

// Los widgets que se dejan en la home: los que aporta el vertical. La lista es
// la fuente de verdad para el filtro del bootstrap, en vez de un prefijo en el
// id que hay que acordarse de mantener sincronizado en dos lados (ya se
// desincronizó una vez y la home quedó vacía).
/** El widget de puesta en marcha del motor: está en toda instancia. */
const WIDGET_SETUP = "nib-setup";

const IDS_PROPIOS = new Set([WIDGET_SETUP, ...verticals.widgets.map(w => w.id)]);

// ── Orden del menú ───────────────────────────────────────────────────────────
//
// El nav de Strapi 5 NO respeta el orden de registro: junta los links de
// plugins con los generales, los ordena alfabéticamente por etiqueta y recién
// ahí los reordena por `position` (`position ?? 6` de fallback). Registrar en
// otro orden no cambia nada; lo único que manda es este número.
//
// Strapi se reserva: 0 Home · 1 Content Manager · 2 Releases · 4 Media Library ·
// 5 Content-Type Builder · 7 Marketplace · 9 Settings.
//
// Home queda PRIMERA —es la puerta de entrada y ahí vive el checklist de puesta
// en marcha— y el bloque de Nib va justo después, antes del Content Manager, en
// el orden del flujo que propone el producto: mirar lo que salió → ajustar quién
// lo escribe → repartirlo → y abajo los insumos y la configuración. El Content
// Manager es el sustrato con el que está construido esto, no la puerta de
// entrada: quien entra al panel viene a ver notas, no a recorrer tablas.
//
// ⚠️ Por eso son DECIMALES y no enteros: Strapi ya ocupó el 0 (Home) y el 1
// (Content Manager), así que la única forma de quedar entre las dos es entre
// medio. Son distintos entre sí a propósito — el comparador de Strapi nunca
// devuelve 0, así que con posiciones empatadas el orden final queda a merced de
// cómo desempate el sort del motor de JS.
const POS = {
  notas: 0.1,
  agentes: 0.2,
  socialStudio: 0.3,
  fuentes: 0.4,
  prompts: 0.5,
  ajustes: 0.6,
  /** Banda para las pantallas del vertical: después de las del motor, antes de Strapi. */
  vertical: 0.7,
} as const;

/**
 * Mezcla la identidad por defecto del motor con la que declare el proyecto.
 *
 * No alcanza con `{ ...DEFAULT, ...vertical }`: `theme` y `translations` son
 * objetos anidados, así que un proyecto que sólo quiere cambiar los colores del
 * tema claro se llevaría puesto el tema oscuro, y uno que traduce una clave del
 * login borraría el resto. Se mergea por locale y por tema; el proyecto gana
 * clave por clave.
 */
function mergeAdminConfig(
  base: typeof DEFAULT_ADMIN_CONFIG,
  own: Record<string, unknown>,
): Record<string, unknown> {
  const ownTheme = (own.theme ?? {}) as { light?: object; dark?: object };
  const ownTranslations = (own.translations ?? {}) as Record<string, object>;
  const locales = new Set([...Object.keys(base.translations), ...Object.keys(ownTranslations)]);

  return {
    ...base,
    ...own,
    theme: {
      light: { ...base.theme.light, ...ownTheme.light },
      dark: { ...base.theme.dark, ...ownTheme.dark },
    },
    translations: Object.fromEntries(
      [...locales].map(loc => [
        loc,
        {
          ...(base.translations[loc as keyof typeof base.translations] ?? {}),
          ...(ownTranslations[loc] ?? {}),
        },
      ]),
    ),
  };
}

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
    // Logo, paleta y textos de marca del login. El motor trae los de Nib y el
    // proyecto los pisa desde la costura (ver mergeAdminConfig).
    ...mergeAdminConfig(DEFAULT_ADMIN_CONFIG, verticals.adminConfig),
    // Menos ruido: saca los videos tutoriales del menú de ayuda y el aviso de
    // "nueva versión de Strapi". (El guided tour de la home se apaga aparte, en
    // register() → disableGuidedTour; `tutorials:false` NO lo cubre.)
    tutorials: false,
    notifications: { releases: false },
    // Idiomas del PANEL. Sin esto Strapi ofrece sólo inglés, y como nuestras
    // pantallas están escritas en castellano el resultado era una mezcla sin
    // salida: el chrome de Strapi en inglés y lo nuestro en español, con un
    // selector de un solo idioma.
    //
    // Strapi ya trae su `es.json` y lo bundlea; lo único que faltaba era
    // listarlo. Elegido «Español», el panel queda entero en castellano —el de
    // Strapi y el nuestro—.
    //
    // ⚠️ Esto NO traduce nuestras pantallas: sus textos están escritos en el
    // JSX, no en archivos de mensajes, así que en inglés siguen saliendo en
    // castellano. Para eso hace falta internacionalizarlas de verdad.
    locales: ["es"],
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
    // Oculta el Marketplace y dibuja el corte entre el bloque de Nib y el de
    // Strapi en el nav. Va por JS y no por `import "./x.css"`: ver el
    // comentario de inject-styles.ts — el import compila pero no llega nunca.
    injectAdminStyles();
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

    // El generador viejo. Quedó sin entrada de menú: /notas + /editor-nota
    // hacen lo mismo y además dejan editar, así que tenerlo en el nav ofrecía
    // dos puertas a la misma tarea y la peor primero. La ruta sigue viva para
    // no romper enlaces guardados de quien la tenga en favoritos.
    app.router.addRoute({
      path: "news-generator/*",
      lazy: async () => {
        const { default: Component } = await import("./pages/NewsGeneratorPage");
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
    // El checklist va primero: en una instancia nueva es lo único que importa,
    // y dice qué falta antes de que los agentes puedan escribir.
    app.widgets.register([
      {
        id: WIDGET_SETUP,
        icon: Command,
        title: { id: "nib.widget.setup", defaultMessage: "Puesta en marcha" },
        component: async () => (await import("./components/SetupChecklistWidget")).default,
      },
    ]);
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
    //
    // El filtro corre siempre. Antes se salteaba cuando el proyecto no declaraba
    // widgets, porque filtrar con la lista vacía dejaba la home en blanco; ahora
    // el motor aporta el checklist, así que esa home nunca queda vacía.
    appRef?.widgets.register(prev => prev.filter(w => IDS_PROPIOS.has(String(w.id ?? ""))));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app.getPlugin("content-manager") as any).apis.addEditViewSidePanel([SocialStudioPanel]);

    // ── Producción: el día a día ─────────────────────────────────────────
    // Notas va primero porque es el tablero: lo que los agentes dejaron listo
    // para revisar y publicar. Es la pantalla a la que se entra, no una más.
    app.addMenuLink({
      to: "/notas",
      icon: BulletList,
      position: POS.notas,
      intlLabel: {
        id: "notas.plugin.name",
        defaultMessage: "Notas",
      },
      permissions: [],
      Component: () => import("./pages/PostReviewPage"),
    });

    app.addMenuLink({
      to: "/ai-agents",
      icon: Magic,
      position: POS.agentes,
      intlLabel: {
        id: "ai-agents.plugin.name",
        defaultMessage: "Agentes IA",
      },
      permissions: [],
      Component: () => import("./pages/AgentsPage"),
    });

    app.addMenuLink({
      to: "/social-studio",
      icon: PaintBrush,
      position: POS.socialStudio,
      intlLabel: {
        id: "social-studio.plugin.name",
        defaultMessage: "Social Studio",
      },
      permissions: [],
      Component: () => import("./pages/SocialStudioPage"),
    });

    // ── Insumos y configuración: se tocan de vez en cuando ───────────────
    app.addMenuLink({
      to: "/rss-feeds",
      icon: Cast,
      position: POS.fuentes,
      intlLabel: {
        id: "rss-feeds.plugin.name",
        defaultMessage: "Fuentes RSS",
      },
      permissions: [],
      Component: () => import("./pages/RssFeedsPage"),
    });

    // `permissions: []` = visible para cualquier admin logueado (Strapi lo
    // interpreta como "sin restricción"). Estas dos pantallas van con una acción
    // RBAC propia, así que sólo las ve el super admin — o el rol al que se la
    // hayan concedido. La página además se protege sola con Page.Protect, porque
    // ocultar el link del menú no bloquea entrar por URL.
    app.addMenuLink({
      to: "/prompt-settings",
      icon: Command,
      position: POS.prompts,
      intlLabel: {
        id: "prompt-settings.plugin.name",
        defaultMessage: "Prompts IA",
      },
      permissions: [{ action: ADMIN_PERMISSIONS.promptSettings, subject: null }],
      Component: () => import("./pages/PromptSettingsPage"),
    });

    app.addMenuLink({
      to: "/site-settings",
      icon: SlidersHorizontal,
      position: POS.ajustes,
      intlLabel: {
        id: "site-settings.plugin.name",
        defaultMessage: "Ajustes del sitio",
      },
      permissions: [{ action: ADMIN_PERMISSIONS.siteSettings, subject: null }],
      Component: () => import("./pages/SettingsPage"),
    });

    // Entradas de menú propias del vertical. Caen en su propia banda, después de
    // las del motor y antes del Content Manager, salvo que el proyecto fije una
    // posición explícita.
    for (const link of verticals.menuLinks) {
      app.addMenuLink({ position: POS.vertical, ...link });
    }
  },
};
