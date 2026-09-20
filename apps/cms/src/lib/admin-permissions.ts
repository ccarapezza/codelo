// Acciones RBAC propias del panel admin.
//
// Sin esto, las páginas custom del menú son visibles y editables por CUALQUIER
// usuario logueado del admin: los menu links se registran con `permissions: []`
// (que Strapi interpreta como "sin restricción") y `requireAdmin()` sólo valida
// que el token sea de un admin activo, sin mirar el rol. Un Editor o un Author
// podía abrir Site Settings o Prompts IA y guardar.
//
// Cómo queda restringido a super admin: Strapi le asigna al rol super admin
// TODAS las acciones registradas en cada arranque (`resetSuperAdminPermissions`),
// así que alcanza con registrar la acción para que sólo él la tenga. Los demás
// roles la reciben únicamente si un super admin se la concede a mano desde
// Settings → Roles → pestaña Configuración (aparecen bajo la categoría "codelo").
//
// ⚠️ Se registran desde el `register()` de src/index.ts, NUNCA desde el
// `bootstrap()`. El bootstrap del plugin admin corre ANTES que el del usuario, y
// ahí adentro hace `resetSuperAdminPermissions()` + `cleanPermissionsInDatabase()`.
// Registrarlas en el bootstrap propio llega tarde siempre: el super admin nunca
// recibe la fila (el reset ya pasó) y cualquier fila concedida a otro rol la
// borra el clean del arranque siguiente por "acción desconocida".

type AdminPermissionAction = {
  /**
   * Sólo admite minúsculas, puntos y guiones — lo valida @strapi/admin con
   * `/^[a-z]([a-z|.|-]+)[a-z]$/`. Nada de dígitos ni guiones bajos.
   */
  uid: string;
  displayName: string;
  section: "settings";
  category: string;
  subCategory: string;
};

export const ADMIN_PERMISSION_ACTIONS: readonly AdminPermissionAction[] = [
  {
    uid: "codelo.site-settings.manage",
    displayName: "Ver y editar",
    section: "settings",
    category: "codelo",
    subCategory: "configuración del sitio",
  },
  {
    uid: "codelo.prompt-settings.manage",
    displayName: "Ver y editar",
    section: "settings",
    category: "codelo",
    subCategory: "prompts de ia",
  },
];

/**
 * IDs tal como Strapi los computa a partir del uid. El prefijo es `api::`
 * porque las acciones no vienen de un plugin (con `pluginName` sería
 * `plugin::<plugin>.<uid>`).
 *
 * Los consume el servidor (controladores, vía `requireAdminPermission`) y el
 * panel (menu links + `Page.Protect`), por eso viven en un módulo sin imports:
 * si las dos puntas se desincronizan, el menú aparece y la API responde 403.
 */
export const ADMIN_PERMISSIONS = {
  siteSettings: "api::codelo.site-settings.manage",
  promptSettings: "api::codelo.prompt-settings.manage",
} as const;

// Tipado estructural mínimo para no importar `@strapi/strapi` en un módulo que
// también entra al bundle del panel. El cast es inevitable: `strapi.service()`
// devuelve el tipo genérico `Service`, que no declara `actionProvider`.
type ActionProviderHost = { service: (uid: string) => unknown };
type PermissionService = {
  actionProvider: {
    registerMany: (actions: readonly AdminPermissionAction[]) => Promise<unknown>;
  };
};

export async function registerAdminPermissionActions(strapi: ActionProviderHost): Promise<void> {
  const permission = strapi.service("admin::permission") as PermissionService;
  await permission.actionProvider.registerMany(ADMIN_PERMISSION_ACTIONS);
}
