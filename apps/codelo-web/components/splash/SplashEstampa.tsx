"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SmokeCanvas } from "./SmokeCanvas";
import styles from "./SplashEstampa.module.css";

/* Splash "La Estampa" — el splash ES el proceso de impresión del logo.
   La dirección del sitio se llama "Dos Tintas" (serigrafía a dos colores
   sobre papel): en vez de animar el logo terminado, el splash lo IMPRIME
   en vivo, pasada por pasada, delante del visitante:

     1. mesa      — cruces de registro se dibujan en las esquinas, rótulo mono.
     2. sol       — la racleta barre hacia abajo y entinta el atardecer ámbar.
     3. tinta     — segunda pasada, hacia arriba, con la tinta azul-negra…
                    FUERA DE REGISTRO (corrida y apenas rotada).
     4. registro  — la capa encaja con un golpe elástico. Esta es la firma:
                    la imperfección que se acomoda.
     5. sello     — el wordmark se estampa debajo, con el lema.
     6. salida    — una última pasada de racleta, a PANTALLA COMPLETA,
                    barre hacia abajo y limpia la impresión revelando el
                    sitio: el splash entra imprimiendo y sale imprimiendo.

   La capa de tinta es el MISMO logo.png con un filtro de umbral
   (grayscale + brightness + contrast): los ámbares se van a blanco y con
   mix-blend-mode multiply el blanco desaparece sobre el disco entintado.
   Al encajar el registro se hace crossfade al PNG real, así el resultado
   final es fiel al logo, no una reconstrucción.

   Debajo de todo, un fondo de humo ambiente: el solver de fluidos a
   pantalla completa, con dos columnas emitiendo desde el borde inferior
   durante toda la impresión. Intensidad contenida: el humo ambienta, la
   coreografía manda. (Hubo un segundo lienzo de "tinta fresca" detrás de
   la estampa; se quitó — dos fuentes de humo competían con el logo.) */

const PHASES = ["mesa", "sol", "tinta", "registro", "sello", "listo"] as const;

// Momentos de entrada de cada fase, en ms (a escala 1).
const TIMELINE = [0, 500, 1700, 2650, 3050, 3900];
const EXIT_AT = 4350;
const EXIT_LEN = 750;

export function SplashEstampa({
  timeScale = 1,
  onDone,
}: {
  /** >1 = cámara lenta (multiplica timeline y animaciones). Para inspección. */
  timeScale?: number;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [stage, setStage] = useState<"print" | "exit" | "done">("print");
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const ids = TIMELINE.map((t, i) => setTimeout(() => setPhase(i), t * timeScale));
    ids.push(setTimeout(() => setStage("exit"), EXIT_AT * timeScale));
    ids.push(
      setTimeout(() => {
        setStage("done");
        doneRef.current?.();
      }, (EXIT_AT + EXIT_LEN) * timeScale),
    );
    return () => ids.forEach(clearTimeout);
  }, [timeScale]);

  if (stage === "done") return null;

  // Cada capa se enciende cuando su fase llega y QUEDA encendida.
  const on = (i: number) => phase >= i;

  return (
    <div
      className={`${styles.overlay} ${stage === "exit" ? styles.exit : ""}`}
      style={{ "--ts": timeScale } as React.CSSProperties}
      role="status"
      aria-label="Cargando Cogollos del Oeste"
    >
      <div className={styles.sheet}>
        {/* Fondo de humo ambiente: sube desde el borde inferior durante toda
            la impresión y se apaga con la salida. Va primero en el DOM para
            quedar detrás de las cruces, la estampa y el progreso. */}
        <div className={styles.smokeBg} aria-hidden="true">
          <SmokeCanvas
            running={stage === "print"}
            timeScale={timeScale+0.35}
            intensity={25}
            fog={2.8}
            emitters={[
              
              //{ x: 0.5, y: 0.85, rate: 0.3, spread: 0 },
            ]}
            className={styles.smokeBgCanvas}
          />
        </div>

        {/* Cruces de registro en las esquinas: se dibujan al montar. */}
        {[styles.markNW, styles.markNE, styles.markSW, styles.markSE].map((pos, i) => (
          <svg
            key={i}
            viewBox="0 0 40 40"
            className={`${styles.mark} ${pos}`}
            style={{ "--md": `${0.15 + i * 0.12}s` } as React.CSSProperties}
            aria-hidden="true"
          >
            <line x1="20" y1="2" x2="20" y2="38" pathLength={1} />
            <line x1="2" y1="20" x2="38" y2="20" pathLength={1} />
            <circle cx="20" cy="20" r="9" pathLength={1} />
          </svg>
        ))}

        <div className={styles.rotulo}>Serigrafía · dos tintas — tiraje 001</div>

        <div className={styles.plate}>
          <div className={styles.press}>
            {/* Pasada 1: el atardecer, en ámbar y ocre. */}
            <div className={`${styles.solDisc} ${on(1) ? styles.solOn : ""}`} />

            {/* Pasada 2: la tinta, fuera de registro hasta la fase 3. */}
            <div
              className={`${styles.inkShift} ${on(3) ? styles.snap : ""}`}
            >
              <Image
                src="/icons/logo.png"
                alt=""
                width={660}
                height={660}
                priority
                className={`${styles.inkLayer} ${on(2) ? styles.inkOn : ""}`}
              />
            </div>

            {/* Fidelidad final: al encajar el registro, crossfade al PNG real. */}
            <Image
              src="/icons/logo.png"
              alt=""
              width={660}
              height={660}
              priority
              className={`${styles.finalLogo} ${on(3) ? styles.finalOn : ""}`}
            />

            {/* Racletas: una por pasada, sincronizadas con cada barrido. */}
            {phase === 1 && <div className={`${styles.squeegee} ${styles.sqDown}`} />}
            {phase === 2 && <div className={`${styles.squeegee} ${styles.sqUp}`} />}
          </div>

          <div className={styles.titles}>
            <div className={`${styles.wordmark} ${on(4) ? styles.stamped : ""}`}>
              Cogollos del Oeste
            </div>
            <div className={`${styles.sublabel} ${on(4) ? styles.sublabelOn : ""}`}>
              Asociación civil · oeste de CABA
            </div>
            <div className={`${styles.lema} ${on(4) ? styles.lemaOn : ""}`}>
              Cultivando conocimiento desde 2011
            </div>
          </div>
        </div>

        <div className={styles.progress}>
          <div className={styles.phaseLabel}>
            {(
              {
                mesa: "Preparando la mesa",
                sol: "Pasada 1 — sol",
                tinta: "Pasada 2 — tinta",
                registro: "Ajustando registro",
                sello: "Sellando",
                listo: "Tiraje listo",
              } as const
            )[PHASES[phase]]}
          </div>
          <div className={styles.bar}>
            <div
              className={styles.fill}
              style={{ width: `${((phase + 1) / PHASES.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pasada final: la racleta a pantalla completa barre hacia abajo y
          "limpia" la impresión — la hoja se recorta con clip-path a su mismo
          ritmo (misma duración y curva), revelando el sitio debajo. Va fuera
          de .sheet para no recortarse a sí misma. */}
      {stage === "exit" && <div className={styles.wipe} aria-hidden="true" />}
    </div>
  );
}
