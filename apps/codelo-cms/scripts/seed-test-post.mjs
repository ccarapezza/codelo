#!/usr/bin/env node
/**
 * Idempotent seed: creates editorial-style posts about the 2026 World Cup,
 * supporting tags, and (when OPENAI_API_KEY is set) AI-generated cover images
 * uploaded to Strapi and attached to each post.
 *
 * Usage:
 *   STRAPI_TOKEN=<full-access-token> \
 *   OPENAI_API_KEY=<sk-...> \           # optional — skip to seed without images
 *   node apps/codelo-cms/scripts/seed-test-post.mjs
 *
 * Optional:
 *   STRAPI_URL  default http://localhost:1337
 *   IMG_QUALITY default "medium" (gpt-image-1 supports low|medium|high)
 *   IMG_SIZE    default "1536x1024" (3:2 — closest to 16:9 in gpt-image-1)
 */

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMG_QUALITY = process.env.IMG_QUALITY ?? "medium";
const IMG_SIZE = process.env.IMG_SIZE ?? "1536x1024";

if (!STRAPI_TOKEN) {
  console.error("✗ Missing STRAPI_TOKEN.");
  console.error("  Generate one in Strapi admin → Settings → API Tokens (Full access).");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.warn("⚠ No OPENAI_API_KEY — skipping cover image generation. Posts will be seeded without images.");
}

const headers = {
  Authorization: `Bearer ${STRAPI_TOKEN}`,
  "Content-Type": "application/json",
};

async function strapi(path, init = {}) {
  const res = await fetch(`${STRAPI_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function findOrCreateTag({ name, slug, kind, reference }) {
  const found = await strapi(`/api/tags?filters[slug][$eq]=${encodeURIComponent(slug)}`);
  const existing = found.data?.[0];
  if (existing) return existing.id;
  const created = await strapi(`/api/tags`, {
    method: "POST",
    body: JSON.stringify({ data: { name, slug, kind, reference } }),
  });
  return created.data.id;
}

async function generateImage(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: IMG_SIZE,
      quality: IMG_QUALITY,
      n: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI image: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image: no b64_json in response");
  return Buffer.from(b64, "base64");
}

async function uploadToStrapi(buffer, filename, alt) {
  const fd = new FormData();
  const blob = new Blob([buffer], { type: "image/png" });
  fd.append("files", blob, filename);
  if (alt) {
    fd.append("fileInfo", JSON.stringify({ alternativeText: alt, caption: alt }));
  }
  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`Strapi upload: ${res.status} ${await res.text()}`);
  }
  const arr = await res.json();
  return arr[0].id;
}

const TAG_DEFS = [
  { name: "Previa Mundial 2026", slug: "previa-mundial-2026", kind: "topic", reference: null },
  { name: "Mundial 2026", slug: "mundial-2026", kind: "worldcup", reference: "2026" },
  { name: "Argentina", slug: "argentina", kind: "team", reference: "argentina" },
  { name: "Brasil", slug: "brasil", kind: "team", reference: "brazil" },
  { name: "Análisis", slug: "analisis", kind: "topic", reference: null },
  { name: "Figuras", slug: "figuras", kind: "topic", reference: null },
  { name: "Lesionados", slug: "lesionados", kind: "topic", reference: null },
];

const PROMPT_BASE =
  "Editorial sports photography, photorealistic, magazine cover style, dramatic moody lighting, cinematic depth of field, no text, no watermarks, no logos.";

const POSTS = [
  {
    slug: "mundial-2026-el-campeon-vuelve-a-un-torneo-que-cambia-para-siempre",
    title: "Mundial 2026: el campeón vuelve a un torneo que cambia para siempre",
    excerpt:
      "Argentina llega a defender la corona en el primer Mundial de 48 selecciones. Tres países, doce grupos, 104 partidos: la previa de una edición que reescribe el manual.",
    tagSlugs: ["previa-mundial-2026", "mundial-2026", "argentina"],
    imagePrompt: `${PROMPT_BASE} Close-up of a golden World Cup-style trophy on a dark moody backdrop, faint blue and white reflections, dim spotlight from above, shallow depth of field, sense of anticipation and history.`,
    imageAlt: "Trofeo iluminado sobre fondo oscuro evocando la antesala del Mundial",
    content: `La cuenta regresiva ya empezó. El 11 de junio de 2026, en el Estadio Azteca de Ciudad de México, México se mide ante Sudáfrica y arranca la edición más grande, más ambiciosa y más extraña de la historia de los Mundiales. **Cuarenta y ocho selecciones, tres países anfitriones, dieciséis sedes, ciento cuatro partidos** repartidos en treinta y nueve días. Lo que durante casi un siglo fue un torneo de bolsillo se convierte, ahora, en un continente entero detenido.

Y en el centro de la escena, otra vez, los mismos nombres.

## El campeón regresa al lugar del crimen

Argentina vuelve a defender una Copa del Mundo después de Qatar. La Selección de Lionel Scaloni cayó en el **Grupo J** junto a Argelia, Austria y Jordania —un sorteo amable en el papel, una emboscada en la cancha como recuerdan en Doha—. El debut será el **16 de junio en el Arrowhead Stadium** de Kansas City, donde la temperatura promedio en junio supera los 30 grados. Detalle no menor: el equipo más sudamericano de la última década llega a un Mundial donde la mitad de los partidos se juegan a pleno verano del hemisferio norte.

Lionel Messi, que jugará a los 38 años, no confirmó pero tampoco descartó. Su entorno repite la misma frase desde la final del Maracaná: *"si llega bien, juega"*. Llegará bien.

## Un formato que nadie probó

La FIFA decidió expandir el torneo a 48 equipos —doce grupos de cuatro, donde los dos primeros y los ocho mejores terceros avanzan a una eliminación de 32—. El resultado es un Mundial con más fixtures que cualquier Champions League, una logística para 16 ciudades en tres países, y una pregunta abierta: **¿el formato premia al regular o al que llega caliente al octavo de final?**

Los expertos están divididos. *"Vas a ver más sorpresas en fase de grupos y menos en eliminación"*, anticipa un ex DT que prefiere no figurar. La estadística histórica le da algo de razón: en los Mundiales con más equipos, los favoritos tienden a llegar más enteros a las semifinales.

## Los grupos que hay que mirar

- **Grupo A** — México, Sudáfrica, Corea del Sur, República Checa: el anfitrión arranca con el peso de abrir un Mundial en su casa. El Azteca, todavía en remodelación, debutó con polémica.
- **Grupo C** — Brasil, Marruecos, Haití, Escocia: la *Canarinha* enfrenta al Marruecos que fue semifinalista en 2022. Es, probablemente, el grupo de la muerte.
- **Grupo H** — España, Cabo Verde, Arabia Saudita, Uruguay: la Roja de Lamine Yamal contra la Celeste de Bielsa. Cabo Verde es la historia bonita.
- **Grupo I** — Francia, Senegal, Irak, Noruega: Mbappé, Sadio Mané y el debut mundialista de Erling Haaland. Para guardar.
- **Grupo K** — Portugal, RD Congo, Uzbekistán, Colombia: el último baile de Cristiano Ronaldo en un escenario mundialista.

## La novedad: los repechajes intercontinentales

Por primera vez, un mini-torneo en marzo de 2026 definió las dos plazas finales. **Bosnia y Herzegovina** dejó afuera a Italia (sí, otra vez Italia se quedó sin Mundial), **Suecia** ganó su Path, **Turquía** y **República Checa** completaron los cupos europeos. Y en México, **RD Congo** e **Irak** se llevaron las dos plazas de la repesca FIFA, dejando afuera a equipos que llegaron con la ilusión.

## La pregunta del millón

Si el Mundial fuera mañana, ¿quién es favorito?

Las casas de apuestas dicen: **España (15%), Francia (12%), Argentina y Brasil (11% cada una), Inglaterra (9%), Portugal (7%), Alemania (6%)**. Hay un dato que no aparece en ninguna planilla: en el último Mundial, los pronosticadores tenían a Argentina en sexto lugar antes del primer partido. Después de la derrota con Arabia Saudita, en quinto. Después del título, fue obvio que siempre debió ser primero.

El fútbol mundial vuelve a moverse. Y otra vez —como siempre— el ruido empieza en Sudamérica.

---

*El Mundial 2026 se juega del 11 de junio al 19 de julio en Canadá, México y Estados Unidos.*
`,
  },
  {
    slug: "grupo-de-la-muerte-laberinto-brasil-mundial-2026",
    title: "Grupo de la muerte: el laberinto de Brasil",
    excerpt:
      "Brasil, Marruecos (semifinalista en 2022), Escocia y Haití comparten el grupo más exigente del Mundial. Análisis del trazado más complicado del cuadro.",
    tagSlugs: ["previa-mundial-2026", "mundial-2026", "brasil"],
    imagePrompt: `${PROMPT_BASE} Close-up of a yellow football jersey hanging in a dim locker room, warm tungsten lighting, leather bench in shadow, cinematic shallow focus, sense of pressure before a match.`,
    imageAlt: "Camiseta amarilla colgada en un vestuario en penumbra",
    content: `Cuando salieron las bolitas en diciembre de 2025 y aparecieron los nombres en la pantalla, en la sala del sorteo de Las Vegas no hubo aplausos. **Brasil. Marruecos. Escocia. Haití.** Cuatro selecciones que, a primera vista, podrían ser un grupo cualquiera. A segunda vista, son el laberinto.

Porque el "grupo de la muerte" del Mundial 2026 no es Argentina-Italia ni España-Alemania. Es una *Canarinha* en reconstrucción que se cruza con el equipo que dejó eliminado a España en 2022, una Escocia con identidad y un Haití que aprendió a no perderle el respeto a nadie.

## Brasil, otra vez con presión

Carlo Ancelotti tomó el banco en 2024 con un encargo simple: **devolverle a Brasil el aura de candidato**. La transición fue dura: la era post-Tite empezó con dudas, con la salida de jugadores históricos y con una eliminación dolorosa en Copa América. Pero el cuerpo técnico italiano sabe qué hacer con plantillas grandes, y la *Verdeamarela* llega al Mundial con **Vinicius, Rodrygo, Endrick y Estêvão** —cuatro de los siete delanteros más caros del mercado actual—.

El problema es que la defensa todavía está en obra. Y en este grupo, los rivales saben atacar.

## El Marruecos que vuelve

En Qatar 2022, Marruecos fue la sorpresa. Eliminó a España por penales, a Portugal en cuartos —Cristiano Ronaldo terminó llorando en el túnel— y solo cayó con Francia en semifinales. Walid Regragui sigue al frente. El plantel mantiene su columna —Hakimi, Ziyech, Saïss, En-Nesyri— y suma juveniles que ahora juegan en la Premier League.

Si Brasil falla concentración una sola vez, los Leones del Atlas le arrancan los tres puntos. No es exageración: en 2022 dejaron la valla en cero contra Bélgica, Croacia y España.

## Escocia: la identidad que duele

Escocia llega después de **tres décadas sin Mundial**. La última vez fue Francia 1998. El equipo de Steve Clarke no es talentoso a primera vista, pero juega como si tuviera siete extremos: presión alta, mucha duela física, y un Andy Robertson que sigue siendo uno de los mejores laterales del mundo.

El partido contra Brasil en el último día puede ser una emboscada al estilo del 2-1 que Croacia le ganó a Brasil en cuartos hace cuatro años. *"Si llegamos vivos al tercero, nos volvemos peligrosos"*, dijo Clarke en una rueda de prensa reciente. No estaba bromeando.

## Haití y la épica que ya escribió

Haití clasificó por la ventana de la nueva CONCACAF y llega con una historia que pocos esperan: **es la primera vez desde 1974 que vuelve a un Mundial**. Su delantero, Frantzdy Pierrot, marcó 14 goles en las eliminatorias. Su técnico, Sébastien Migné, conoce el Mundial africano y sabe lo que es ganar contra equipos más caros.

No van a ganar el grupo. Pero van a complicarle la vida a Brasil en el segundo partido.

## Las cuentas

Para que Brasil termine primero, necesita ganarle a Marruecos en el primer partido. Si empata, queda colgada de los resultados ajenos —y este grupo no tiene partidos fáciles—.

Los pronosticadores dan **Brasil 60% de probabilidad de pasar como primero, Marruecos 25%, Escocia 11%, Haití 4%**. Son los porcentajes más parejos de cualquier grupo. El "grupo de la muerte" del Mundial 2026 no se llama así por la suma de talento. Se llama así por la **distancia entre el papel y la cancha**.

Tres semanas en Estados Unidos. Cuatro selecciones que no se respetan ni se subestiman. Y una *Canarinha* que, otra vez, sale a probarse.
`,
  },
  {
    slug: "italia-otra-vez-afuera-mundial-2026",
    title: "Italia, otra vez afuera: la madre de todas las eliminaciones",
    excerpt:
      "Bosnia y Herzegovina dejó a Italia sin su tercer Mundial consecutivo. La eliminación tiene contexto, pero el dolor es más grande que las explicaciones.",
    tagSlugs: ["previa-mundial-2026", "mundial-2026", "analisis"],
    imagePrompt: `${PROMPT_BASE} Empty professional football dressing room, blue jersey draped over a wooden bench, cold blue lighting filtering from a window, lonely melancholic mood, cinematic wide shot, faint sense of defeat.`,
    imageAlt: "Vestuario vacío con una camiseta azul sobre un banco",
    content: `Marzo de 2026, Sarajevo. La final del Path A de la UEFA termina 1-1 después del tiempo reglamentario, 1-1 después del suplementario, y se va a penales. **Bosnia 4 - Italia 1**. Edin Džeko, a los 39 años, lleva los brazos al cielo. En el banco italiano, Luciano Spalletti se cubre la cara con la mano izquierda. *"Es indescriptible"*, dice apenas, después.

Italia no va a estar en el Mundial 2026. Por **tercera vez consecutiva**.

## La crónica del descenso

Italia ganó la Eurocopa 2020 con un equipo que parecía el regreso definitivo. Al mes siguiente perdió el repechaje contra Macedonia del Norte y se quedó afuera de Qatar 2022. En 2024 hubo una recuperación parcial: cuartos en la Eurocopa, eliminación con Suiza. Y en septiembre de 2025, en las eliminatorias para el Mundial, terminó segunda detrás de Noruega y bajó al repechaje.

El sorteo le dio a Bosnia. Sobre el papel, Italia era favorita. Sobre el césped, Bosnia jugó mejor en los 90 minutos y mejor todavía en los penales.

## Lo que se rompe cuando Italia no juega

Italia es **cuatro veces campeona del mundo**. La tercera selección con más títulos. Una potencia histórica, cultural, identitaria. Cuando faltó en 2018 fue un escándalo; cuando faltó en 2022 fue una crisis; cuando falta en 2026 es ya un patrón.

Y el patrón tiene nombres concretos:

- **Falta de centrodelantero**. Después de Vialli, Toni, Inzaghi, llegó la era del *9 falso* y la Serie A dejó de producir goleadores natos.
- **Pasaporte y pasaporte**. Las generaciones de jugadores con doble nacionalidad —italo-argentinos, italo-brasileños— dejaron de elegir Italia.
- **El sistema italiano**. La Liga aún factura, pero perdió velocidad e identidad. La selección refleja eso.

## Bosnia, la historia bonita

Bosnia y Herzegovina vuelve a un Mundial **doce años después**. La última vez fue Brasil 2014, donde llegó con Edin Džeko, Miralem Pjanić y Asmir Begović. Ahora vuelve con Džeko todavía vigente —un caso de longevidad raro— y con una nueva generación que jugó este partido como si supiera que era la única chance de su carrera.

La FIFA tendrá un equipo con peso emocional en el Grupo B junto a Canadá, Qatar y Suiza. No será candidato. Pero ya hizo historia.

## La Italia que viene

Spalletti probablemente continúa al frente del equipo —su contrato vence en 2027— pero la presión va a ser distinta. La generación de Donnarumma, Barella y Tonali tiene 30 años en promedio para 2030. Si para entonces Italia no clasifica, son **cuatro Mundiales seguidos sin Italia**. Sería, sencillamente, el peor ciclo de la historia del fútbol italiano.

Mientras tanto, los italianos van a ver el Mundial por TV. Otra vez.
`,
  },
  {
    slug: "los-nuevos-del-mundial-cabo-verde-uzbekistan-curacao-2026",
    title: "Los nuevos del Mundial: Cabo Verde, Uzbekistán y Curaçao escriben su primera página",
    excerpt:
      "Por primera vez en su historia, tres selecciones llegan al Mundial. Cabo Verde, Uzbekistán y Curaçao protagonizan las historias bonitas del cuadro.",
    tagSlugs: ["previa-mundial-2026", "mundial-2026"],
    imagePrompt: `${PROMPT_BASE} Three pairs of professional football boots arranged in a row on lush green grass, viewed from above, warm golden hour light, dew drops, cinematic flat lay, magazine editorial.`,
    imageAlt: "Tres pares de botines sobre el césped al amanecer",
    content: `Cada Mundial tiene su historia bonita. La Croacia de 1998. La Senegal de 2002. La Islandia de 2018. El Mundial 2026, con su formato expandido a 48 selecciones, multiplicó las posibilidades. Y se permitió tres debutantes a la vez: **Cabo Verde, Uzbekistán y Curaçao**.

Para que se entienda la magnitud: en 96 años de Mundiales, solo había debutado **un país nuevo en promedio por edición**. El 2026 cambia esa ecuación.

## Cabo Verde: el archipiélago que aprendió a competir

Cabo Verde tiene **medio millón de habitantes**. Menos que la ciudad de Mendoza. Es un archipiélago atlántico frente a la costa de Senegal, con una liga local que mueve cantidades de plata que cualquier club de la B Nacional miraría con desdén.

Y sin embargo, la federación caboverdiana entendió hace una década algo que a otros les sigue costando: **la diáspora**. Hijos de inmigrantes en Portugal, Francia, Países Bajos, Estados Unidos. Jugadores formados en ligas europeas que, al cumplir años en plantillas saturadas, eligen vestir la camiseta del país de sus padres.

El resultado es una selección con jugadores en el Spórting de Lisboa, en el FC Porto, en el Eintracht Frankfurt. Le ganaron la clasificación a Camerún —tres veces semifinalista mundialista— en una eliminatoria que terminó en empate técnico y se decidió por diferencia de gol.

Caen en el Grupo H con España, Uruguay y Arabia Saudita. No van a ganarlo. Pero el partido contra España en el Mercedes-Benz Stadium de Atlanta va a tener algo distinto: **Cabo Verde no tiene nada que perder**.

## Uzbekistán: el silencio del Asia Central

Si Cabo Verde es la historia visible, Uzbekistán es la silenciosa. Veintisiete millones de habitantes, una liga doméstica con apenas un equipo conocido (Pakhtakor Tashkent), y una federación que clasificó por primera vez después de **siete intentos consecutivos**.

El equipo está construido sobre una base sólida en clubes rusos y de la liga china, con un entrenador local —Timur Kapadze— y un mediapunta que viene haciendo ruido en Europa: **Eldor Shomurodov**, ex Roma y Spezia. No hay estrellas globales. Hay disciplina, presión y un esquema 4-2-3-1 que les permite competir contra equipos más talentosos.

En el Grupo K se cruzan con Portugal, Colombia y RD Congo. El partido más importante para ellos no es contra Cristiano: es **el primero, contra Colombia**. Si arañan un punto ahí, el grupo se les abre.

## Curaçao: el imposible aritmético

Curaçao tiene **150.000 habitantes**. Es la selección más chica de la historia en clasificar a un Mundial. Más chica que Trinidad y Tobago en 2006, más chica que Islandia en 2018. Está al lado de Aruba, en el Caribe holandés, y juega sus partidos en un estadio para 15.000 personas.

¿Cómo llegó? Misma fórmula que Cabo Verde: la diáspora holandesa. Jugadores como **Tahith Chong** (Birmingham), Leandro Bacuna (Cardiff) y Cuco Martina (PEC Zwolle) eligieron a Curaçao por encima de Países Bajos. La generación de Patrick Kluivert —que entrena al equipo— hizo el resto.

Caen en el Grupo E con Alemania, Costa de Marfil y Ecuador. El partido inaugural contra Alemania en el NRG Stadium de Houston probablemente se vuelva un blowout. Pero Curaçao no fue al Mundial a perder dignamente: fue a **demostrar que el fútbol es más grande que la geografía**.

## Lo que viene

Las tres selecciones ya cumplieron. Calificar es la parte difícil, lo dijeron mil veces los técnicos antes que ellos. Lo que pase del 11 de junio en adelante es bonus track. Y aunque ninguna llegue a octavos —es probable que ninguna lo haga— ya están escribiendo lo que muchos llaman el **Mundial más diverso de la historia**.
`,
  },
  {
    slug: "48-selecciones-104-partidos-manual-mundial-2026",
    title: "48 selecciones, 104 partidos, 39 días: el manual del Mundial más grande",
    excerpt:
      "Doce grupos de cuatro, octavos a 32 equipos y la presión sobre la FIFA por una expansión que parte aguas. Cómo se juega el Mundial 2026.",
    tagSlugs: ["previa-mundial-2026", "mundial-2026", "analisis"],
    imagePrompt: `${PROMPT_BASE} Aerial wide shot of a modern football stadium at night, floodlights casting dramatic beams across an empty pitch, clear summer sky, photographic realism, sense of scale and anticipation.`,
    imageAlt: "Vista aérea de un estadio iluminado de noche",
    content: `La FIFA tomó la decisión en enero de 2017. La votación fue casi unánime: el Mundial pasaría de **32 a 48 selecciones**. Un torneo más grande, más comercial, más logístico. Más todo. Ocho años después, el plan se ejecuta. Y muchos —incluyendo gente dentro de la propia FIFA— todavía no están seguros si fue una buena idea.

Esta es la guía rápida del nuevo formato.

## Los doce grupos

Las 48 selecciones se dividen en **doce grupos de cuatro equipos**. Cada selección juega tres partidos en su grupo. Los **dos primeros de cada grupo** clasifican automáticamente. Los **ocho mejores terceros** completan los 32 que avanzan a la fase eliminatoria.

Esto es un cambio enorme respecto del formato anterior. Antes, terminar tercero significaba volver a casa. Ahora, en el peor de los casos, los ocho mejores terceros también pasan. Solo cuatro selecciones —las que terminan terceras con peor performance entre las doce— quedan eliminadas en fase de grupos.

**Implicación práctica**: muchas selecciones van a poder priorizar el partido más débil y especular en los otros dos. Es matemáticamente más difícil quedar afuera. Eso le quita drama a los últimos partidos de grupo.

## La fase eliminatoria

Con 32 equipos en octavos, el Mundial gana **una ronda extra**. Antes había 16 partidos eliminatorios (octavos a final). Ahora hay 32. Los partidos saltan a:

- **Octavos** — 16 partidos
- **Cuartos** — 8 partidos
- **Octavos finales** — 4 partidos
- **Semifinales** — 2 partidos
- **Final** — 1 partido (más uno por el tercer puesto)

Total: **104 partidos** en todo el torneo. La final es el **19 de julio** en el MetLife Stadium de Nueva Jersey.

## Las sedes: 16 estadios, 3 países

México, Estados Unidos y Canadá se reparten las sedes. **Estados Unidos tiene 11 estadios**, México 3, Canadá 2.

- **Apertura**: 11 de junio, Estadio Azteca (Ciudad de México)
- **Final**: 19 de julio, MetLife Stadium (East Rutherford, NJ)
- **Tercer puesto**: Hard Rock Stadium (Miami)

La logística es histórica. Una selección que termine primera en su grupo en Vancouver puede tener que jugar octavos en Atlanta, cuartos en Dallas y semifinal en Filadelfia. **Hay equipos que van a recorrer 10.000 km dentro del torneo**.

## Lo que cambia para el espectador

Más partidos significa más fútbol. **104 partidos en 39 días** son **2,7 partidos diarios** en promedio. Habrá días con 6 partidos simultáneos. Habrá sedes con tres partidos en una semana.

Esto plantea un problema nuevo: **¿qué partido mirar?**. La FIFA y los broadcasters están preparando coberturas multiventana, donde los espectadores pueden ver tres partidos en pantalla a la vez. Es la NFL del fútbol, en cierto sentido.

## Los críticos

No todos están convencidos. **Arsène Wenger** —ex Arsenal, hoy director de desarrollo de la FIFA— es uno de los pocos directivos que defendió el formato sin reservas. Otros, como **Jürgen Klopp** o **Pep Guardiola**, criticaron la expansión por sobrecarga deportiva.

*"Estamos pidiéndole a los jugadores demasiado fútbol al año"*, dijo Guardiola en una conferencia reciente. *"En algún momento el sistema se rompe."*

La FIFA argumenta lo contrario: que el nuevo formato **reparte mejor las plazas globalmente**, que da chances reales a confederaciones más chicas como AFC y CAF, y que aumenta el alcance comercial del torneo. Las dos cosas son ciertas.

## Y para 2030

El próximo Mundial —España, Portugal, Marruecos, con partidos también en Argentina, Uruguay y Paraguay para conmemorar el centenario— ya está confirmado con **48 selecciones**. El nuevo formato vino para quedarse.

El Mundial cambia de tamaño en 2026. Para mejor o peor, eso lo decidirán los próximos 39 días.
`,
  },
  {
    slug: "lesionados-mundial-2026-mapa-bajas-dudas",
    title: "El Mundial 2026 que se juega en la enfermería",
    excerpt:
      "Diez bajas confirmadas, doce dudas activas. La temporada europea más larga llega al final con sus mejores nombres rotos. Argentina, Brasil, España y Alemania, con jugadores clave contrarreloj.",
    tagSlugs: ["previa-mundial-2026", "mundial-2026", "lesionados", "analisis"],
    imagePrompt: `${PROMPT_BASE} Empty professional football medical room, single jersey draped over a treatment table, dim warm lighting from a single lamp, somber and clinical atmosphere, cinematic depth of field, sense of waiting and uncertainty.`,
    imageAlt: "Sala de fisioterapia vacía con una camiseta sobre la camilla",
    content: `Faltan 46 días para el debut del Mundial 2026 y el panorama no se decide solo en las canchas. Se decide también en quirófanos, salas de fisioterapia y resonancias magnéticas. **Diez bajas confirmadas**, **doce dudas activas**, y un patrón que se repite: la temporada europea más larga de la historia llega al final con sus mejores nombres rotos.

## Los que ya no están

La lista de bajas confirmadas es brutal. **Rodrygo**, que iba a ser pieza titular del ataque brasileño, se rompió los ligamentos cruzados y el menisco de la rodilla derecha. Brasil pierde a su recambio principal de Vinicius. **Hugo Ekitike**, el delantero del Nottingham Forest que disputaba el 9 de Francia con Mbappé, sufrió la rotura del tendón de Aquiles derecho — recuperación estimada hasta 2027. **Jack Grealish** queda fuera de la convocatoria inglesa por una fractura por estrés en el pie izquierdo.

Para Argentina son dos bajas particularmente sensibles: **Juan Foyth**, defensor central de Villarreal, y **Joaquín Panichelli**, joven delantero del Racing Strasbourg. Foyth con tendón de Aquiles roto, Panichelli con ligamento cruzado. Ambos descartados.

Alemania pierde a **Serge Gnabry** por desgarro de aductores. España al delantero **Samu Omorodión** del Porto, también con cruzados. La lista sigue: **Mohamed Salisu** (Ghana), **Takumi Minamino** (Japón), **Luis Malagón** (México) — todos con lesiones de gravedad estructural. Países Bajos suma a **Xavi Simons**, también con rotura de cruzado.

## La carrera contrarreloj

Donde se juega el Mundial dentro del Mundial es en la lista de doce nombres en duda. **Lamine Yamal**, la estrella de la nueva España, sufrió una rotura en el isquiotibial izquierdo — recuperación mínima de **cinco semanas**. Llegará al primer partido contra Cabo Verde con lo justo. **Mikel Merino**, mediocampista de Arsenal y pieza clave del esquema de De La Fuente, está fuera por fractura por estrés y se duda que vuelva a tiempo.

Argentina tiene su propio pulseo. **Cristian Romero** sufrió una lesión de ligamentos laterales en marzo, recuperación estimada en 5 a 8 semanas. **Lautaro Martínez** arrastra un esfuerzo del soleo y recién retomaría competencia en mayo. Si los dos llegan, el campeón vigente arma su columna defensiva-ofensiva. Si uno de los dos no, Scaloni reescribe el plan.

Brasil enfrenta una situación más oscura. **Éder Militão** y **Estêvão** en duda — el central del Real Madrid con desgarro del bíceps femoral que requiere cirugía, el juvenil del Chelsea con lesión muscular grado 4. Los reportes brasileños hablan de *"prácticamente descartado"* para Estêvão.

Alemania reza por **Marc-André ter Stegen**, su arquero titular tras la era Neuer, fuera por isquiotibial — el cuerpo técnico admitió que las chances *"son muy pocas"*. Inglaterra sigue de cerca a **Reece James**, con dolencia muscular sin diagnóstico cerrado. Croacia ya perdió a **Joško Gvardiol** del Manchester City por fractura de tibia — la rehabilitación es de 4 a 6 meses, fuera del Mundial.

Egipto sigue con esperanza a **Mohamed Salah**, que sufrió una rotura de isquiotibial. El equipo médico del Liverpool anunció cuatro semanas de tratamiento y la federación egipcia confirmó que llegaría al torneo, aunque sin garantías sobre el ritmo.

## El patrón que se repite

Si se trazara un mapa de las lesiones graves de los últimos 60 días, dos diagnósticos dominan la pantalla: **rotura de cruzado anterior** (al menos seis casos) y **rotura de tendón de Aquiles** (Foyth, Ekitike, Malagón). Lesiones que no perdonan y dejan a los jugadores fuera meses, sin posibilidad de juego rápido.

Los técnicos europeos vienen alertando hace temporadas sobre la sobrecarga de partidos. Champions League ampliada con fase liga de ocho fechas, Mundial de Clubes en julio del año pasado, eliminatorias UEFA, Liga de Naciones, tres ligas domésticas con 38 fechas o más. *"Le estamos pidiendo a los jugadores demasiado fútbol"*, dijo Pep Guardiola el mes pasado en Etihad. *"En algún momento el cuerpo dice basta."*

El Mundial 2026 lo está probando de la peor manera.

## Por selección, en pocas líneas

- **Argentina**: dos bajas (Foyth, Panichelli) y dos dudas grandes (Romero, Lautaro). Messi, contra todo pronóstico, llega bien.
- **Brasil**: ya sin Rodrygo, con Militão y Estêvão en duda y Neymar lejos del plantel ideal. Ancelotti rearma sobre Vinicius.
- **España**: Yamal en duda con cinco semanas mínimo de recuperación, Merino casi descartado. Omorodión confirmado fuera.
- **Francia**: pierde a Ekitike. Mbappé, recuperado de las molestias de rodilla de marzo, llega al 100%.
- **Alemania**: Gnabry fuera, ter Stegen casi descartado. La defensa y el arco en revisión total.
- **Inglaterra**: sin Grealish. Reece James en duda. Bellingham y Saka, sanos.
- **Países Bajos**: pierde a Xavi Simons, una de las piezas creativas clave.
- **Croacia**: sin Gvardiol, su lateral más valioso.

## Lo que viene

Los entrenadores tienen hasta el **1 de junio** —10 días antes del debut— para confirmar las listas finales de 26 jugadores. Hasta esa fecha se reescriben planes, se evalúan resonancias y se hacen apuestas a la recuperación de jugadores que podrían no estar al 100%.

El Mundial empieza el 11 de junio. La medicina deportiva, en realidad, ya empezó hace meses.

---

*Datos compilados de Infobae, Al Jazeera, beIN Sports y Tribuna. Última actualización: 28 de abril de 2026.*
`,
  },
  {
    slug: "mbappe-haaland-yamal-cambio-de-guardia-mundial-2026",
    title: "Mbappé, Haaland, Yamal: el Mundial donde se completa el cambio de guardia",
    excerpt:
      "Tres delanteros que tienen la edad y la temporada para definir un Mundial. ¿Qué pasa cuando Messi y Cristiano son la sombra y no el centro?",
    tagSlugs: ["previa-mundial-2026", "mundial-2026", "figuras"],
    imagePrompt: `${PROMPT_BASE} Three young athletic football players in silhouette against bright stadium spotlights, intensity and sweat, dramatic backlight, cinematic rim lighting, sense of generational change.`,
    imageAlt: "Tres jugadores en contraluz contra los reflectores del estadio",
    content: `Cuando Argentina se consagró en Qatar 2022, **Lionel Messi tenía 35 años, Cristiano Ronaldo 37 y Karim Benzema 35**. La generación que dominó el fútbol mundial entre 2008 y 2022 jugó su último Mundial completo. Cuatro años después, en 2026, esa misma generación está casi toda fuera de escena.

Messi probablemente juegue —llega con 38 años pero con minutos competitivos en el Inter Miami—. Cristiano va con Portugal a su sexto y último Mundial. Pero ya no son los protagonistas. Los protagonistas, esta vez, son tres apellidos jóvenes que entran al Mundial a manejar el escenario.

## Kylian Mbappé: el favorito de los pronosticadores

Mbappé llega al Mundial 2026 con **27 años**, el liderazgo absoluto de Francia y un contrato con el Real Madrid que lo posicionó como el delantero más valioso del mundo. Sus números son lo de siempre: **38 goles en 41 partidos** la temporada pasada con el Madrid.

Caen en el Grupo I con Senegal (con Sadio Mané), Irak y Noruega. El partido contra Noruega es **el clásico de esta nueva generación**: Mbappé contra Haaland, dos de los tres mejores del mundo, en un mismo grupo.

Si Francia clasifica primera —cosa probable— el camino a la final es nominalmente más complejo que el de otros candidatos. Pero Mbappé llega en un punto donde **sabe ganar**. Ganó la Liga, ganó la Eurocopa con Francia en 2024, ganó la Liga de Naciones. Le falta el Mundial. Y este es, posiblemente, su última gran chance de ganarlo como protagonista absoluto.

## Erling Haaland: el debut imposible

Haaland tiene **25 años** y es **delantero del Manchester City**. Lleva tres temporadas seguidas con más de 30 goles en la Premier League. Si fuera por talento individual, sería favorito para Bota de Oro de cualquier Mundial.

El problema es que es noruego.

Noruega clasificó al Mundial 2026 después de **24 años de ausencia**. La última vez fue Francia 1998. Ese equipo, modesto y físico, llegó hasta octavos antes de caer con Italia. Esta versión, comandada por Haaland, llega a un grupo accesible —Senegal y Francia son los favoritos, pero Irak es claramente el más débil— y Haaland tiene el grupo de **arrancar el Mundial con dos goles fáciles**.

¿Puede Noruega llegar lejos? Probablemente no. Pero el camino emocional ya está trazado: Haaland va a anotar. Y cada gol va a ser noticia mundial. Su Mundial es un solo partido contra Francia. Si lo gana, se vuelve la historia del torneo. Si lo pierde, queda como el Mundial donde **Haaland llegó tarde**.

## Lamine Yamal: el adolescente que no tiene techo

Yamal tiene **18 años**. Cuando termina el Mundial 2026 cumple 19. Sus números con el Barcelona son obscenos: **34 goles, 28 asistencias** en 86 partidos profesionales antes de cumplir los 18. Su rendimiento con la selección española en la Eurocopa 2024 lo terminó de catapultar a candidato al Balón de Oro.

España llega como **segunda favorita de las casas de apuestas** —por detrás de Francia—. Cae en el Grupo H con Cabo Verde, Arabia Saudita y Uruguay. Es probablemente uno de los grupos más cómodos del cuadro. Yamal tiene tres partidos para mostrar lo que sabe en escenario mundial.

El argumento contra Yamal es la edad. Ningún jugador de 18 años fue determinante en un Mundial desde Pelé en 1958. La presión, los rivales más físicos, el viaje. Pero Yamal ya jugó la Eurocopa, ya ganó la Liga, y todos los ojos van a estar encima. Si España gana el Mundial, **Yamal es Balón de Oro 2026** automático.

## Lo que cambia

Cuando Messi levantó la copa en Qatar, fue el cierre de un ciclo. Argentina ganó, sí, pero el verdadero protagonista del Mundial fue **el adiós colectivo** de una generación que mantuvo en alto el fútbol durante quince años. Cristiano se fue de la Champions, Modrić tomó la última gira, Suárez bajó a la MLS.

En 2026, el fútbol se abre. Hay tres delanteros con las herramientas técnicas y la edad para imponerse. Hay también un Lautaro Martínez, un Vinicius, un Bukayo Saka, un Florian Wirtz que pueden cambiar la historia con un partido.

El **cambio de guardia** se completa. La pregunta es cuál de los tres apellidos termina con la copa.
`,
  },
];

async function findOrCreatePost(post, tagBySlug) {
  const existing = await strapi(
    `/api/posts?filters[slug][$eq]=${encodeURIComponent(post.slug)}&populate=coverImage`,
  );
  if (existing.data?.[0]) {
    return { post: existing.data[0], created: false };
  }
  const tagIds = post.tagSlugs.map((slug) => tagBySlug[slug]).filter(Boolean);
  const created = await strapi(`/api/posts`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        tags: tagIds,
        publishedAt: new Date().toISOString(),
      },
    }),
  });
  return { post: created.data, created: true };
}

async function ensureCoverImage(strapiPost, def) {
  if (!OPENAI_API_KEY) return false;
  if (!def.imagePrompt) return false;
  if (strapiPost.coverImage) return false;

  console.log(`    ↻ generating cover (${IMG_SIZE}, ${IMG_QUALITY})…`);
  const buffer = await generateImage(def.imagePrompt);
  const filename = `${def.slug}.png`;
  const mediaId = await uploadToStrapi(buffer, filename, def.imageAlt ?? def.title);
  console.log(`    ↥ uploaded media id=${mediaId}`);

  const documentId = strapiPost.documentId ?? strapiPost.id;
  await strapi(`/api/posts/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({ data: { coverImage: mediaId } }),
  });
  return true;
}

async function main() {
  console.log(`→ ${STRAPI_URL}`);

  console.log("→ Tags");
  const tagBySlug = {};
  for (const def of TAG_DEFS) {
    tagBySlug[def.slug] = await findOrCreateTag(def);
  }
  console.log(`  · ${Object.keys(tagBySlug).length} tags ready`);

  console.log("→ Posts");
  for (const def of POSTS) {
    const { post, created } = await findOrCreatePost(def, tagBySlug);
    console.log(`  · ${def.slug} — ${created ? "created" : "exists"} (id=${post.id})`);

    // Even for existing posts, fetch with populate to know if cover needs generating.
    const populated = created
      ? (await strapi(`/api/posts/${post.documentId ?? post.id}?populate=coverImage`)).data
      : post;

    try {
      const generated = await ensureCoverImage(populated, def);
      if (generated) console.log(`    ✓ cover image attached`);
    } catch (err) {
      console.error(`    ✗ cover image failed: ${err.message}`);
    }
  }

  console.log("\n✓ Done.");
}

main().catch((err) => {
  console.error("✗ Failed:", err.message);
  process.exit(1);
});
