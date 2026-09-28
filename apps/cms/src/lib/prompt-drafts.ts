// La versión en castellano de los valores neutros del motor.
//
// Los campos de instrucción se le mandan al modelo EN INGLÉS —todo el andamiaje
// lo está y los modelos rinden mejor y gastan menos ahí—, pero quien configura
// esto habla castellano. Sin una versión legible, el modo "escribir en mi
// idioma" arrancaba en blanco y no servía para nada.
//
// ⚠️ Están escritas a mano, no generadas en tiempo real. Es a propósito: se ven
// a la primera, sin esperar ni gastar una llamada, y son texto REVISADO en vez
// de una traducción que nadie leyó. Si se toca un valor neutro en
// prompt-defaults.ts, hay que tocar su par acá — `prompt-drafts.test.ts` avisa
// si uno se queda sin el otro.
//
// Esto NO se le manda a ningún modelo. Es lo que se muestra para leer y editar;
// lo que corre es siempre el campo final.

/** Sólo los campos de instrucción: los de texto literal ya están en el idioma del sitio. */
export const NEUTRAL_PROMPT_DRAFTS: Record<string, string> = {
  domainDescription: "un sitio de noticias independiente",

  fabricationProneFacts: "fechas, cifras, decisiones oficiales o declaraciones",

  analysisModeFraming:
    "claramente presentado como opinión o análisis. Nunca afirmes un hecho reciente como si estuviera confirmado.",

  officialSources:
    "organismos oficiales, leyes, fallos judiciales, reguladores, revistas con revisión de pares",

  dedupExamples: [
    "Mismo hecho = mismo tema Y el mismo suceso concreto: por ejemplo, la misma decisión publicada, el mismo fallo, el mismo estudio, el mismo anuncio de la misma organización.",
    "NO son duplicados: una propuesta y su aprobación posterior; dos organizaciones DISTINTAS haciendo cada una lo mismo; el mismo antecedente citado en dos notas sin relación; una nota que explica un trámite y la noticia de que ese trámite cambió; una continuación que aporta hechos nuevos de verdad.",
  ].join("\n"),

  bodyStructureGuide: [
    "## FORMATO DEL CUERPO — Markdown rico y bien estructurado (nunca HTML)",
    "- Devolvé SÓLO Markdown de GitHub. Nunca uses etiquetas HTML (<p>, <strong>, <em>, <br>, etc.).",
    "- Abrí con una entradilla fuerte de 2 o 3 oraciones (sin encabezado arriba: el título es el H1).",
    "- Partí la nota en secciones con subtítulos `##` cuando tenga sustancia suficiente (2 o 3 en una nota de ~600 palabras; una nota muy corta puede llevar uno solo o ninguno). Los subtítulos tienen que ser específicos e informativos, nunca genéricos como 'Introducción' o 'Conclusión'.",
    "- Usá listas con viñetas (`- `) para enumeraciones y listas numeradas para pasos o cronologías.",
    "- Poné toda cita textual o declaración como blockquote de Markdown (`> `), dejando claro quién lo dijo.",
    "- Resaltá en negrita (`**...**`) los nombres, fechas, cifras y hechos concretos para que la nota se pueda barrer con la vista; usá cursiva (`*...*`) con moderación, para términos técnicos o extranjeros.",
    "- Variá el largo de los párrafos y evitá un muro de párrafos iguales.",
  ].join("\n"),

  imageSystemInstructions: [
    "Generás descripciones de imagen concisas y vívidas para generación por IA.",
    "Las imágenes son portadas editoriales de notas de un sitio de noticias general.",
    "",
    "- Describí UNA sola escena continua. Nunca paneles, grillas, antes/después ni collages de imágenes separadas.",
    "- El medio (fotografía, ilustración, impresión) te lo asignan por portada. Respetalo: si dice ilustración, no describas una fotografía.",
    "- Preferí objetos, lugares y situaciones antes que personas. Si una persona es inevitable, armá la toma para que la cara no se lea —de espaldas, recortada, fuera de foco, en silueta— nunca mutilando el cuerpo.",
    "- No nombres personas, marcas ni organizaciones reales: el modelo las escribe como texto dentro de la imagen.",
    "- A sangre. Sin bordes, sin marcos, sin mockups, sin texto, sin marcas de agua, sin logos.",
  ].join("\n"),

  imageThemeGuide: [
    "TEMA → ESCENAS (elegí exactamente UNA categoría y exactamente UNA de sus variantes)",
    "",
    "INSTITUCIONES / DECISIONES: (a) una sala de reuniones vacía después de la sesión; (b) una pila de papeles firmados sobre un escritorio; (c) el pasillo de un edificio público; (d) un atril sin orador.",
    "ECONOMÍA / TRABAJO: (a) manos en un banco de trabajo; (b) un muelle de carga a primera hora; (c) un mostrador al abrir; (d) herramientas ordenadas.",
    "CIENCIA / INVESTIGACIÓN: (a) instrumentos sobre una mesada de laboratorio; (b) un cuaderno con mediciones; (c) muestras en una gradilla; (d) una pantalla con una lectura, vista de costado.",
    "COMUNIDAD / GENTE: (a) sillas en ronda antes del encuentro; (b) una cartelera con papeles clavados; (c) una mesa compartida después de la reunión; (d) la puerta abierta de un salón.",
    "SALUD: (a) una sala de espera vista desde la entrada; (b) una carpeta sobre el escritorio de un consultorio; (c) un pasillo con luz suave; (d) la ventana de una sala de tratamiento.",
    "AMBIENTE: (a) un paisaje al amanecer; (b) agua al borde de algo construido; (c) un sendero entre árboles; (d) un horizonte bajo el clima.",
    "CULTURA: (a) una sala antes de que llegue el público; (b) un instrumento o una herramienta en reposo; (c) una pared de afiches; (d) un taller al final del día.",
    "HISTORIA / ANIVERSARIO: (a) un cajón de archivo entreabierto; (b) una foto vieja sobre una mesa; (c) una fachada gastada; (d) una página impresa bajo luz cálida.",
  ].join("\n"),

  imageAnchorTaxonomy: [
    "- topic: el tema principal de ESTA nota, en una o dos palabras.",
    "- palette: los colores con los que debería construirse la escena, si la nota sugiere alguno.",
    "- eventType: qué tipo de hecho es — una decisión, un lanzamiento, un fallo, un encuentro.",
    "- venue: el lugar o el ámbito, sólo si la nota nombra uno.",
  ].join("\n"),

  socialVoice:
    "Voz de marca: clara y cercana, sin solemnidad. No publicites productos, marcas ni comercios.",

  socialCoverStyle:
    "que refleje el TEMA de la nota, sin texto, sin logos y sin caras reconocibles",

  coverFallbackPrompt: "Imagen editorial, cinematográfica, sin texto, sin logos, sin caras.",

  videoStyle:
    "Estilo: video editorial documental, atmósfera cinematográfica, luz natural suave, " +
    "cámara lenta sutil y movimiento leve y continuo. Formato vertical 9:16. Dejá el centro " +
    "y la mitad inferior más oscuros y despejados para sobreimprimir texto. MUY IMPORTANTE: " +
    "sin ningún texto, sin letras, sin números, sin logos, sin marcas de agua.",

  videoDefaultPrompt:
    "Una superficie con textura a contraluz, movimiento leve, profundidad de campo corta, " +
    "luz dorada de la mañana, sin personas ni rostros",

  translationGlossary:
    "- NO traduzcas nombres propios: nombres de organizaciones, instituciones y programas, nombres de leyes y decretos, nombres de lugares.",
};
