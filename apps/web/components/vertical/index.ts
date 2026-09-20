// Ranuras que ESTE proyecto le aporta al motor.
//
// El motor importa de acá sin saber qué hay adentro y trata todo como
// opcional: lo que no se exporta simplemente no existe, y el motor cae a su
// comportamiento por defecto. Con todo en `undefined`, el sitio funciona — se
// ve sobrio, que es la idea de la base.
//
// Cada ranura existe porque el motor tiene un hueco declarado:
//   · LayoutExtras    — algo al final del <body> (un splash, un banner global).
//   · FooterArt       — decoración de fondo del pie.
//   · CoverFallback   — la portada de una nota que todavía no tiene imagen.
//                       Sin esto: un degradado con el título.
//   · PageDecoration  — qué mostrar en una página del CMS sin portada propia.

export const LayoutExtras: (() => React.ReactNode) | undefined = undefined;
export const FooterArt: (() => React.ReactNode) | undefined = undefined;
export const CoverFallback:
  | ((props: {
      title: string;
      seed: string;
      kicker?: string;
      showTitle?: boolean;
      className?: string;
    }) => React.ReactNode)
  | undefined = undefined;
export const PageDecoration: ((props: { variant?: string }) => React.ReactNode) | undefined =
  undefined;
