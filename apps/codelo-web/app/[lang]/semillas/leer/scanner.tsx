"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScanQrCode, X } from "lucide-react";

/**
 * DataMatrix scanner for the INASE security stamp.
 *
 * Loaded lazily on click: @zxing/browser is ~200 KB and most visitors will type
 * the cultivar rather than scan. It fills the `serie` field — it does not
 * resolve anything on its own, because the serial is not checkable against any
 * public source (see lib/match.ts).
 */
export function StampScanner({ onResult }: { onResult: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  // Guards against the reader firing twice for the same frame before we tear
  // the stream down.
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    doneRef.current = false;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all(
          [import("@zxing/browser"), import("@zxing/library")],
        );

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;

        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined, // let the browser pick; on phones this is the rear camera
          videoRef.current,
          result => {
            if (!result || doneRef.current) return;
            doneRef.current = true;
            onResult(result.getText());
            stop();
          },
        );
      } catch (err) {
        if (cancelled) return;
        // Denied permission, no camera, or an insecure origin. All of them mean
        // the same thing for the user: type it by hand instead.
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "No pudimos acceder a la cámara. Podés escribir la serie a mano."
            : "No pudimos iniciar el escáner. Podés escribir la serie a mano.",
        );
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onResult, stop]);

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="label inline-flex items-center gap-1.5 border border-rule px-3 py-2 text-ember hover:border-ember"
        >
          <ScanQrCode className="size-4" aria-hidden />
          Escanear la estampilla
        </button>
      ) : (
        <div className="max-w-sm">
          <div className="relative border border-rule">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="block w-full" />
            <button
              type="button"
              onClick={stop}
              aria-label="Cerrar el escáner"
              className="absolute top-2 right-2 border border-rule bg-background/90 p-1.5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="label mt-2 text-muted-foreground">
            Apuntá al código cuadrado de la estampilla
          </p>
        </div>
      )}

      {error ? <p className="mt-2 font-serif text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}
