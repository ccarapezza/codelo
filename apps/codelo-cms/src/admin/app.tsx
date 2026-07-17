import { Magic, Cog, Cast, ChartBubble, Pencil, Images, Feather } from "@strapi/icons";
import type { StrapiApp } from "@strapi/strapi/admin";
import SocialStudioPanel from "./components/SocialStudioPanel";

export default {
  config: {},
  bootstrap(app: StrapiApp) {
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

    app.addMenuLink({
      to: "/site-settings",
      icon: Cog,
      intlLabel: {
        id: "site-settings.plugin.name",
        defaultMessage: "Site Settings",
      },
      permissions: [],
      Component: () => import("./pages/SettingsPage"),
    });

    app.addMenuLink({
      to: "/prompt-settings",
      icon: Pencil,
      intlLabel: {
        id: "prompt-settings.plugin.name",
        defaultMessage: "Prompts IA",
      },
      permissions: [],
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

    app.addMenuLink({
      to: "/audit",
      icon: ChartBubble,
      intlLabel: {
        id: "audit.plugin.name",
        defaultMessage: "Audit IA",
      },
      permissions: [],
      Component: () => import("./pages/AuditPage"),
    });
  },
};
