// Campos propios del vertical en los AJUSTES DEL SITIO (single type
// `site-setting`), no en los editoriales.
//
// Es una COSTURA. Van acá las claves que sólo tienen sentido para un módulo
// propio del proyecto — por ejemplo el modelo con el que se lee una norma, que
// existe únicamente si el proyecto tiene un lector de normas.
//
// Una clave nueva necesita además su atributo en el schema.json de
// `site-setting` y su tarjeta en admin/verticals.ts (`settingCards`) para poder
// editarse. Sin esta lista el controller la descarta: es lo que evita que el
// panel muestre un campo que se guarda en la nada.
export const verticalSettingKeys: readonly string[] = [];
