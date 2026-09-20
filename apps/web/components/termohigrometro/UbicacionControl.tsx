"use client";

import { LocateFixed, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COOKIE_UBICACION, redondearCoord, serializarLugar } from "@/lib/weather";

type Estado = "idle" | "pidiendo" | "denegado" | "error";

/**
 * Nombra unas coordenadas. BigDataCloud es gratis y sin key; se llama desde el
 * BROWSER a propósito: su cuota del endpoint `reverse-geocode-client` es por IP
 * del navegador, así que desde el server todas las visitas compartirían una
 * sola IP y lo agotaríamos rápido. Además las coordenadas ya están acá.
 *
 * Falla suave: si no hay nombre, la etiqueta son las coordenadas. El clima
 * funciona igual — solo queda feo.
 */
async function nombrarLugar(lat: number, lon: number): Promise<string> {
  const coords = `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"} · ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? "O" : "E"}`;
  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("localityLanguage", "es");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return coords;

    const json = (await res.json()) as { locality?: string; city?: string; countryName?: string };
    const nombre = [json.locality, json.city].find(v => typeof v === "string" && v.trim());
    return nombre?.trim() || coords;
  } catch {
    return coords;
  }
}

/**
 * Ajuste de ubicación del instrumento.
 *
 * Nunca pide permiso al cargar: un prompt de geolocalización no solicitado es
 * antipatrón y hunde la tasa de aceptación. Solo al hacer clic.
 *
 * Guarda en cookie (no localStorage) porque es lo que el server necesita leer
 * para renderizar la lectura correcta de una — y porque es la convención del
 * repo, ver ThemeToggle.tsx.
 */
export function UbicacionControl({ esDefault }: { esDefault: boolean }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("idle");

  const pedir = () => {
    if (!("geolocation" in navigator)) {
      setEstado("error");
      return;
    }
    setEstado("pidiendo");

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = redondearCoord(pos.coords.latitude);
        const lon = redondearCoord(pos.coords.longitude);
        const label = await nombrarLugar(lat, lon);

        document.cookie = `${COOKIE_UBICACION}=${encodeURIComponent(serializarLugar(lat, lon, label))}; path=/; max-age=2592000; samesite=lax`;
        setEstado("idle");
        router.refresh();
      },
      err => {
        // code 1 = PERMISSION_DENIED. No ofrecer reintento: el browser recuerda
        // la negativa y un segundo clic no haría nada visible.
        setEstado(err.code === 1 ? "denegado" : "error");
      },
      { timeout: 8000, maximumAge: 600_000 },
    );
  };

  const volver = () => {
    document.cookie = `${COOKIE_UBICACION}=; path=/; max-age=0; samesite=lax`;
    setEstado("idle");
    router.refresh();
  };

  if (estado === "denegado") {
    return (
      <p role="status" className="label opacity-70">
        {t("wx.denegado")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {esDefault ? (
        <button
          type="button"
          onClick={pedir}
          disabled={estado === "pidiendo"}
          aria-busy={estado === "pidiendo"}
          className="label termo-boton"
        >
          <LocateFixed aria-hidden="true" className="size-3.5" />
          {estado === "pidiendo" ? t("wx.pidiendo") : t("wx.usarUbicacion")}
        </button>
      ) : (
        <button
          type="button"
          onClick={volver}
          className="label termo-boton"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          {t("wx.volverDefault")}
        </button>
      )}

      {estado === "error" ? (
        <span role="status" className="label opacity-70">
          {t("wx.errorUbicacion")}
        </span>
      ) : null}
    </div>
  );
}
