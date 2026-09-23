// Mete los retoques cosméticos del panel en el documento.
//
// ⚠️ NO alcanza con `import "./algo.css"` desde app.tsx, aunque compile sin
// chistar. Vite sí junta ese CSS y emite el archivo (dist/build/strapi-*.css,
// con las reglas adentro), pero el index.html que sirve Strapi no lo linkea y
// el chunk de entrada tampoco lo pide: la hoja queda publicada y nunca cargada.
// Verificado en 5.31.2 contra el panel andando — `document.styleSheets` sólo
// tenía los dos <style> de styled-components y el Marketplace seguía visible
// pese a la regla que lo oculta. Falla sin error y sin dejar rastro; el CSS
// está ahí, parece bien, y no hace nada.
//
// Por eso el CSS se pide con `?inline` (Vite lo devuelve como string) y se
// inyecta a mano en un <style>. Las reglas siguen viviendo en archivos .css de
// verdad, no en un template literal, así que conservan formato y comentarios.

import hideMarketplace from "./hide-marketplace.css?inline";
import menuGroups from "./menu-groups.css?inline";
import ilustraciones from "./ilustraciones.css?inline";

export function injectAdminStyles(): void {
  try {
    const ID = "nib-admin-styles";
    if (document.getElementById(ID)) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = [hideMarketplace, menuGroups, ilustraciones].join("\n");
    document.head.appendChild(style);
  } catch {
    // Cosmético: si algo falla, el panel funciona igual. Nunca debe romper el
    // arranque.
  }
}
