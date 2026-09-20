"use client";

import { useHoraViva } from "./RelojVivo";
import { SegLectura } from "./SieteSegmentos";

/** El reloj del aparato: hh:mm en siete segmentos, con los dos puntos latiendo. */
export function RelojSegmentos({
  zona,
  horaServidor,
  rotulo,
  tamano = "chico",
}: {
  zona: string;
  horaServidor: string;
  rotulo: string;
  tamano?: "grande" | "chico" | "micro";
}) {
  const hhmm = useHoraViva(zona, horaServidor);
  return <SegLectura value={hhmm} ancho={4} sr={`${rotulo}: ${hhmm}`} tamano={tamano} />;
}
