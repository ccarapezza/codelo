/**
 * Fallback de <Suspense>. Reserva alto para que la llegada de la lectura no
 * empuje el panel del Boletín (CLS). Sin shimmer: el design system prohíbe
 * gradientes decorativos que no vengan del atardecer del logo.
 */
export function TermohigrometroSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="min-h-[15rem] border-t border-rule" />
  );
}
