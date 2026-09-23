// Tipografías y logo por defecto de las placas.
//
// ⚠️ Los COLORES ya no están acá. Viven en `site-setting` y se editan desde el
// panel (Sitio e integraciones → Identidad visual), porque tenerlos en código
// obligaba a editar TypeScript y reconstruir la imagen para que una instancia
// nueva dejara de publicar las placas de Nib. Un proyecto que venía de la
// versión anterior carga los suyos una sola vez con su semilla
// (`verticals/seed.ts`, clave `siteSettings`) y de ahí en más manda la base.
//
// Lo que queda es lo que ES un archivo y no se puede escribir en un campo:
//
//   · Las FUENTES tienen que nombrar una familia que satori haya cargado de
//     `lib/social-cards/assets/fonts/`. Nombrar una que no está no da ningún
//     error: dibuja con otra. Para usar otra tipografía hay que dejar el .woff
//     en esa carpeta y nombrarlo acá.
//   · El LOGO por defecto es el archivo de `assets/logo/`. Se usa mientras no
//     haya ninguno subido desde el panel, que es el camino normal.

/** Familias tipográficas. Tienen que estar cargadas en assets/fonts/. */
export const BRAND_FONTS = {
  fontDisplay: "Anton",
  fontBody: "Inter",
};

/** Nombre del archivo dentro de lib/social-cards/assets/logo/. */
export const LOGO_FILE = "nib.png";
