"use client";

import * as React from "react";

// Banner de "vista previa" (draftMode). Se muestra arriba de la nota cuando se
// está viendo el BORRADOR. Es iframe-aware:
//   - Embebido en el panel (Notas): el botón avisa al padre (postMessage) para
//     que cierre el modal; el panel se encarga de limpiar draftMode navegando el
//     iframe al endpoint de salida.
//   - En pestaña propia (top-level): link normal que sale de draftMode y vuelve
//     a la versión publicada.
export function PreviewBanner({ exitTo }: { exitTo: string }) {
  const [inIframe, setInIframe] = React.useState(false);

  React.useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      // Acceder a window.top cross-origin lanza: seguro estamos embebidos.
      setInIframe(true);
    }
  }, []);

  const closeFromIframe = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Limpia la cookie de draftMode ANTES de avisar al panel: al ser un fetch
    // same-origin dentro del iframe, se completa sin carrera con el desmontaje
    // del modal (el padre recién cierra al recibir el postMessage). Así el modo
    // borrador no queda activo si después se navega el sitio en ese origen.
    try {
      await fetch("/api/preview/exit?to=/", { cache: "no-store" });
    } catch {
      /* no-op */
    }
    try {
      window.parent.postMessage({ type: "codelo-preview-close" }, "*");
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-[#E4B569] px-4 py-2 text-center font-mono text-xs font-semibold uppercase tracking-wide text-[#00001C]">
      <span>Vista previa — estás viendo el borrador, no la versión publicada</span>
      {inIframe ? (
        <button
          type="button"
          onClick={closeFromIframe}
          className="rounded border border-[#00001C]/40 px-2 py-0.5 underline underline-offset-2 hover:bg-[#00001C]/10"
        >
          Cerrar
        </button>
      ) : (
        <a
          href={`/api/preview/exit?to=${encodeURIComponent(exitTo)}`}
          className="rounded border border-[#00001C]/40 px-2 py-0.5 underline underline-offset-2 hover:bg-[#00001C]/10"
        >
          Salir
        </a>
      )}
    </div>
  );
}
