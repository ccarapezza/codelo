import { X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Página institucional a medida — "el pliego del estatuto". Reemplaza al
 * renderer markdown genérico (CmsPageView) SOLO para esta ruta: el contenido
 * institucional es estable y estructurado (fechas, objetos, cláusulas,
 * registros) y se beneficia de una maqueta infográfica que el markdown no
 * puede expresar. El texto sigue siendo el de docs/contenido/quienes-somos.md;
 * si aquel cambia, esta vista se actualiza a mano.
 *
 * Las viñetas de los cuatro objetos son SVG propios en la gramática de las
 * láminas: trazos de tinta (currentColor, sigue al tema) + acentos en ámbar
 * (var(--sun)). Sin ciudad: la escena urbana del friso no pertenece a esta
 * página, que habla de estatuto y territorio, no de skyline.
 */

/* ————— Viñetas a dos tintas (96×96, trazo tinta + plano ámbar) ————— */

const VIGNETTE_CLASS = "h-16 w-16 sm:h-20 sm:w-20";

/** Hoja bajo la lupa: investigación y estudio del cultivo. */
function VignetteInvestigacion() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={VIGNETTE_CLASS} fill="none">
      <circle cx="44" cy="40" r="18" fill="var(--sun)" />
      {[-70, -35, 0, 35, 70].map(a => (
        <path
          key={a}
          d="M44 52 C41 44 41 35 44 28 C47 35 47 44 44 52 Z"
          fill="currentColor"
          transform={`rotate(${a} 44 52)`}
        />
      ))}
      <circle cx="44" cy="40" r="26" stroke="currentColor" strokeWidth="5" />
      <path d="M62.5 58.5 L79 75" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/** Lámina de herbario: rama y hongo sobre línea de base — Plantae y Fungi. */
function VignetteEtnobotanica() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={VIGNETTE_CLASS} fill="none">
      <path d="M10 78 H86" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 78 C28 62 28 50 30 34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M29 62 C22 58 18 52 17 44 C25 47 29 53 29 62 Z" fill="currentColor" />
      <path d="M30 48 C37 44 41 38 42 30 C34 33 30 39 30 48 Z" fill="currentColor" />
      <path d="M30 34 C27 26 28 18 31 12 C34 18 34 27 30 34 Z" fill="currentColor" />
      <path
        d="M50 56 C52 40 61 32 67 32 C73 32 82 40 84 56 Z"
        fill="var(--sun)"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M62 56 L61 78 L73 78 L72 56 Z" fill="currentColor" />
    </svg>
  );
}

/** Cuenco que sostiene el sol: derecho a la salud, cuidado, reducción de daños. */
function VignetteDerechos() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={VIGNETTE_CLASS} fill="none">
      {[-165, -125, -90, -55, -15].map(a => {
        const rad = (a * Math.PI) / 180;
        const x1 = 48 + 19 * Math.cos(rad);
        const y1 = 38 + 19 * Math.sin(rad);
        const x2 = 48 + 27 * Math.cos(rad);
        const y2 = 38 + 27 * Math.sin(rad);
        return (
          <path
            key={a}
            d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="48" cy="38" r="13" fill="var(--sun)" stroke="currentColor" strokeWidth="4" />
      {/* Cuenco bien más ancho que el sol, con boca elíptica: vasija, no bulbo. */}
      <path d="M16 54 C16 72 30 80 48 80 C66 80 80 72 80 54 Z" fill="currentColor" />
      <path d="M38 86 H58" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** Sol en el horizonte sobre surcos con brote: ambiente y uso sustentable. */
function VignetteAmbiente() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={VIGNETTE_CLASS} fill="none">
      <path
        d="M30 44 A18 18 0 0 1 66 44 Z"
        fill="var(--sun)"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M48 20 V12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M29 27 L23 21" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M67 27 L73 21" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 44 H86" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M14 58 Q48 52 82 58" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 68 Q48 62 78 68" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M24 78 Q48 73 72 78" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M31 64 C31 60 31 58 32 55" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 55 C28 53 26 50 26 46 C30 48 32 51 32 55 Z" fill="var(--sun)" />
      <path d="M32 55 C36 53 38 50 38 46 C34 48 32 51 32 55 Z" fill="var(--sun)" />
    </svg>
  );
}

/* ————— Contenido (fuente: docs/contenido/quienes-somos.md) ————— */

const HITOS = [
  {
    year: "2011",
    title: "Primeros encuentros",
    detail:
      "En plena persecución a cultivadores, un grupo del oeste se junta para contenerse y compartir información seria. Desde entonces co-organizamos la Marcha Nacional y Mundial de la Marihuana.",
  },
  {
    year: "2012–13",
    title: "Talleres y debate",
    detail:
      "Primer taller de cultivo, participación en el debate por la despenalización en el Congreso y stand en las Jornadas Universitarias sobre Cannabis de la UNQui.",
  },
  {
    year: "2016–17",
    title: "Asociación civil",
    detail:
      "Constitución formal y personería jurídica (Res. I.G.J. N° 1435/2017). Debate de la Ley 27.350 en Diputados y un protocolo de abordaje que acompañó a más de 500 familias.",
  },
  {
    year: "2018",
    title: "Sede en Caballito",
    detail:
      "Primera sede social: más talleres y actividades culturales. Co-fundación del Acuerdo por la Regulación Legal del Cannabis, del que seguimos participando.",
  },
  {
    year: "2020–21",
    title: "Virtualidad y REPROCANN",
    detail:
      "La pandemia lleva los talleres a la virtualidad, con alcance latinoamericano. Con la llegada del REPROCANN, el acompañamiento en el registro se vuelve parte central del trabajo.",
  },
  {
    year: "2024–25",
    title: "Estatuto reformado",
    detail:
      "Resolución I.G.J. N° 735/2025 — N° 2083 del Libro 5. El objeto incorpora la investigación y el estudio del cultivo en el marco de la Ley 27.350.",
  },
] as const;

const OBJETOS = [
  {
    kicker: "Ley 27.350",
    title: "Investigación y cultivo",
    body: "Investigación y estudio del cultivo de cannabis y sus derivados —semillas, esquejes, extracciones y demás procesos— dentro del marco de la Ley 27.350 y sus normas reglamentarias.",
    Vignette: VignetteInvestigacion,
  },
  {
    kicker: "Plantae · Fungi",
    title: "Etnobotánica",
    body: "Conocimiento y relevamiento bibliográfico de plantas y hongos, con especial énfasis en el cannabis en todas sus especies — incluidas las aptas para el aprovechamiento agroindustrial y alimentario (cáñamo o hemp).",
    Vignette: VignetteEtnobotanica,
  },
  {
    kicker: "Salud · DDHH",
    title: "Derechos humanos",
    body: "El derecho a la salud, la soberanía alimentaria y las estrategias de reducción de daños en el abordaje del consumo problemático de sustancias, lícitas o no.",
    Vignette: VignetteDerechos,
  },
  {
    kicker: "Recursos naturales",
    title: "Ambiente",
    body: "La preservación del medio ambiente y el aprovechamiento sustentable de los recursos naturales.",
    Vignette: VignetteAmbiente,
  },
] as const;

const MEDIOS = [
  "Este portal como medio de difusión",
  "Talleres, cursos, charlas y debates",
  "Convenios con profesionales e instituciones públicas y privadas",
  "Seguimiento de los avances de la comunidad científica en fuentes reconocidas",
] as const;

const LIMITES = [
  "Sin consejo médico ni dosis",
  "Sin publicidad de productos, marcas o comercios",
  "Sin contenido dirigido a menores",
] as const;

const FICHA = [
  { k: "Denominación", v: "Asociación Civil Cogollos del Oeste" },
  { k: "CUIT", v: "30-71548582-2" },
  { k: "Personería jurídica", v: "Res. I.G.J. N° 1435/2017 · N° 999, Libro 1" },
  { k: "Estatuto reformado", v: "Res. I.G.J. N° 735/2025 · N° 2083, Libro 5" },
  { k: "Medio de difusión", v: "cogollosdeloeste.com.ar" },
] as const;

export async function QuienesSomosView() {
  const t = await getTranslations("pages");

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 sm:px-8">
      <header className="section-rule pt-5 pb-12">
        <p className="label text-ember">{t("eyebrowAbout")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight text-balance">
          Quiénes somos
        </h1>
        <p className="mt-5 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Somos <strong className="text-foreground">Cogollos del Oeste</strong>, una asociación
          civil sin fines de lucro del oeste de la Ciudad de Buenos Aires: cultivadores y
          activistas que nos juntamos desde 2011 alrededor del cultivo y la información
          responsable — mucho antes de tener papeles.
        </p>
      </header>

      {/* Línea de tiempo: reglas ámbar con marcas de registro. Es la secuencia
          real (encuentros → talleres → personería → sede → virtualidad →
          reforma), no numeración decorativa. En escritorio, dos bandas de tres
          hitos con su propia regla; vertical en el teléfono. Fuentes de los
          hitos: docs/contenido/quienes-somos.md (AUNO 2017, El Planteo). */}
      <section aria-label="Historia de la asociación">
        <ol className="space-y-10 border-l-[3px] border-sun pl-7 sm:grid sm:grid-cols-3 sm:gap-x-8 sm:gap-y-12 sm:space-y-0 sm:border-l-0 sm:pl-0">
          {HITOS.map(hito => (
            <li key={hito.year} className="relative sm:border-t-[3px] sm:border-sun sm:pt-7">
              <span
                aria-hidden
                className="absolute top-2 -left-[35.5px] h-3 w-3 rounded-full bg-sun sm:-top-[7.5px] sm:left-0"
              />
              <p className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {hito.year}
              </p>
              <p className="label mt-2 text-ember">{hito.title}</p>
              <p className="mt-2 font-serif text-[0.95rem] leading-relaxed text-muted-foreground">
                {hito.detail}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-10 font-serif text-sm leading-relaxed text-muted-foreground">
          Parte de esta historia quedó registrada en la prensa: una entrevista en{" "}
          <a
            href="https://auno.org.ar/hay-una-caceria-absurda-contra-los-cultivadores-de"
            rel="noopener noreferrer"
            target="_blank"
            className="text-ember hover:underline"
          >
            AUNO (2017)
          </a>{" "}
          y un perfil en{" "}
          <a
            href="https://elplanteo.com/cogollos-del-oeste/"
            rel="noopener noreferrer"
            target="_blank"
            className="text-ember hover:underline"
          >
            El Planteo
          </a>
          .
        </p>
      </section>

      {/* Los cuatro objetos del Art. 2°: placas separadas por filetes, nunca
          tarjetas (anti-patrón de la casa). Cada una con su viñeta grabada. */}
      <section className="section-rule mt-16 pt-4" aria-labelledby="que-hacemos">
        <p className="label text-ember">Qué hacemos</p>
        <h2 id="que-hacemos" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Cuatro objetos de trabajo
        </h2>
        <p className="mt-3 max-w-2xl font-serif leading-relaxed text-muted-foreground">
          Nuestro estatuto (Artículo 2°) fija el temario de la asociación.
        </p>
        <div className="mt-8 grid sm:grid-cols-2">
          {OBJETOS.map((objeto, i) => (
            <div
              key={objeto.title}
              className={cn(
                "border-b border-rule py-8 last:border-b-0",
                "sm:px-8 sm:first:pl-0 sm:[&:nth-child(3)]:pl-0 sm:[&:nth-child(even)]:pr-0",
                i % 2 === 0 && "sm:border-r",
                i >= 2 && "sm:border-b-0",
              )}
            >
              <objeto.Vignette />
              <p className="label mt-5 text-ember">{objeto.kicker}</p>
              <h3 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {objeto.title}
              </h3>
              <p className="mt-2.5 font-serif leading-[1.7] text-foreground/90">{objeto.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-rule mt-16 pt-4" aria-labelledby="como-trabajamos">
        <p className="label text-ember">Cómo trabajamos</p>
        <h2 id="como-trabajamos" className="sr-only">
          Cómo trabajamos
        </h2>
        <ul className="mt-6 grid max-w-3xl gap-x-10 gap-y-3 sm:grid-cols-2">
          {MEDIOS.map(medio => (
            <li key={medio} className="flex gap-3 font-serif leading-[1.7] text-foreground/90">
              <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 bg-sun" />
              {medio}
            </li>
          ))}
        </ul>
        <p className="mt-7 max-w-3xl font-serif leading-[1.75] text-foreground/90">
          Cooperamos en el acceso al cannabis medicinal de quienes lo necesitan en pos de su
          salud, brindando asesoramiento, información y educación sobre plantas medicinales y
          sus métodos de cultivo — siempre como divulgación general, nunca como indicación
          médica.
        </p>
      </section>

      {/* El edicto: la cláusula literal del estatuto entre filetes dobles,
          como un aviso legal impreso. Es el único bloque enfático de la
          página — la audacia se gasta acá. */}
      <section className="mt-16 border-y-[3px] border-foreground" aria-labelledby="lo-que-no">
        <div className="my-[5px] border-y border-foreground/35 px-1 py-9 sm:px-2 sm:py-10">
          <p className="label text-ember">Lo que no hacemos · Estatuto, Artículo 2° — textual</p>
          <blockquote
            id="lo-que-no"
            className="mt-5 max-w-3xl font-serif text-xl leading-snug text-ember sm:text-2xl"
          >
            «En ningún caso, estos objetos y las actividades arriba mencionadas comprenderán el
            fomento de consumo de sustancia alguna, lícita o no, ni la indicación o prescripción
            de cualquier forma de tratamientos médicos o similares.»
          </blockquote>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-6">
            {LIMITES.map(limite => (
              <li key={limite} className="label flex items-start gap-2 leading-relaxed">
                <X aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-ember" strokeWidth={3} />
                {limite}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl font-serif text-sm leading-relaxed text-muted-foreground">
            Las actividades que requieren un profesional las realizan personas con título y
            matrícula habilitante.
          </p>
        </div>
      </section>

      {/* Ficha registral: los datos duros como formulario impreso, con puntos
          conductores entre rótulo y valor. */}
      <section className="section-rule mt-16 pt-4" aria-labelledby="ficha">
        <p className="label text-ember">Ficha registral</p>
        <h2 id="ficha" className="sr-only">
          Datos institucionales
        </h2>
        <dl className="mt-6 max-w-3xl space-y-4">
          {FICHA.map(row => (
            <div key={row.k} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="label text-muted-foreground">{row.k}</dt>
              <span
                aria-hidden
                className="hidden min-w-8 flex-1 border-b border-dotted border-foreground/30 sm:block"
              />
              <dd className="font-mono text-sm">{row.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-14 font-serif text-lg leading-relaxed">
        ¿Querés consultarnos o participar?{" "}
        <Link href="/contacto" className="font-medium text-ember hover:underline">
          Escribinos
        </Link>
        .
      </p>
    </main>
  );
}
