// Ranuras que ESTE proyecto le aporta al motor.
//
// El motor importa de acá sin saber qué hay adentro y trata todo como
// opcional: un proyecto que no aporte una ranura simplemente no la exporta, y
// el motor cae a su comportamiento por defecto.
//
// Cada ranura existe porque el motor tiene un hueco declarado, no porque a
// alguien le quedó cómodo: algo extra al final del layout, la decoración del
// pie, y la portada de las notas sin imagen.

export { SiteSplash as LayoutExtras } from "./splash/SiteSplash";
export { FooterArt } from "./FooterArt";
export { CoverFallback } from "./CoverFallback";
export { PageDecoration } from "./PageDecoration";
