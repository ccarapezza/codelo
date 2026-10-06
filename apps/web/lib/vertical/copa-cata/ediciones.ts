// Las ocho ediciones de la Copa Cata del Oeste (2014–2022), con procedencia.
//
// Es historia, no agenda: se cuenta lo que pasó, sin tabú y sin invitar a
// nada. Los precios van como dato histórico; de las marcas, la cantidad (sus
// logos se ven en las piezas de la época); del lugar, solo la zona.
//
// La interfaz muestra solo lo que se sabe: un campo sin valor no aparece. Las
// notas, las contradicciones y lo que falta quedan acá como procedencia, para
// quien edite los datos; no se imprimen. Detalle por edición en el repo de
// secretaría (salidas/copas/); acá queda lo publicable, cada dato con el id de
// su fuente en `fuentes.ts`.

import type { Edicion } from "./tipos";

const SIN_DATO = { valor: null, fuente: null } as const;
const NO_FIGURA = { valor: null, fuente: null, nota: "No figura en ninguna fuente." } as const;
const NO_PUBLICAMOS = "No publicamos el nombre del lugar ni la dirección.";

export const EDICIONES: Edicion[] = [
  // ── 1ª · 2014 ─────────────────────────────────────────────────────────
  {
    anio: 2014,
    numero: 1,
    rotulo: "1ª",
    rotuloAlt: ["1ra"],
    nombre: "1ª Copa Cata del Oeste",
    etapa: "grupo",
    fecha: "2014-06-14",
    diaSemana: "sábado",
    fechaFuentes: ["invitacion-2014", "datos-2014"],
    horaInicio: {
      valor: "14:00",
      fuente: "invitacion-2014",
      nota: "La presentación de muestras era de 12:00 a 12:45, según el correo del 13/06/2014.",
    },
    lugar: { valor: "Flores, CABA", fuente: "web-0010", nota: NO_PUBLICAMOS },
    formato: [
      {
        texto:
          "Se convocó como «1ra Cata Copa de socios de Cogollos del Oeste»: un encuentro solo para socios, cada uno con un acompañante.",
        fuente: "invitacion-2014",
      },
      {
        texto:
          "Puntuaban los participantes, en tarjetas. El jurado no calificaba: aportaba información sobre cada muestra.",
        fuente: "invitacion-2014",
      },
      { texto: "Se previeron mesas de cuatro a seis personas.", fuente: "propuesta-2014" },
      { texto: "La cata se hizo en dos tandas por mesa.", fuente: "web-0010" },
      {
        texto: "Un cultivador reconocido asistió sin competir, por tratarse de una competencia amateur.",
        fuente: "web-0010",
      },
    ],
    categoriasTexto: SIN_DATO,
    muestras: SIN_DATO,
    participantes: SIN_DATO,
    cupo: {
      valor: null,
      fuente: "propuesta-2014",
      nota: "La propuesta a un espacio que finalmente no fue la sede preveía 60 lugares: no es el cupo de la Copa.",
    },
    mesas: SIN_DATO,
    entrada: {
      valor: "La cuota mensual de socio ($50) más un bono de $50",
      fuente: "invitacion-2014",
    },
    marcas: {
      min: 6,
      max: 6,
      fuentes: ["web-0010"],
      nota: "Los comercios que aportaron premios, según la crónica.",
    },
    jurado: null,
    palmares: { fuentes: [], nota: "No hay registro de ganadores: la crónica no los nombra." },
    cronica: {
      autor: "Gato",
      fecha: "2014-08-05",
      wayback:
        "https://web.archive.org/web/20221005131041/https://cogollosdeloeste.com.ar/cws/codeloweb/article/10",
      fuente: "web-0010",
      resumen:
        "Crónica en primera persona de un participante: el viaje hasta el barrio de Flores, la cata en mesas compartidas, en dos tandas, y la espera de los resultados. No nombra a los ganadores: el autor cuenta que no llegó al podio y que la muestra ganadora había pasado por su mesa.",
      cita: "al podio lo vi por TV!, pero me sentí ganador igual por haber participado",
    },
    heroGrafica: null,
    fuentes: [
      "propuesta-2014",
      "invitacion-2014",
      "datos-2014",
      "web-0010",
      "credencial-2014",
      "rotulos-2014",
    ],
    contradicciones: [
      {
        tema: "Quién calificaba las muestras",
        versiones: [
          { valor: "Un jurado y los propios participantes", fuente: "propuesta-2014" },
          {
            valor: "Solo los participantes; el jurado aportaba información sobre cada muestra",
            fuente: "invitacion-2014",
          },
        ],
        nota: "La propuesta es una semana anterior a la invitación a los socios.",
      },
    ],
    faltantes: [
      "Ganadores: la crónica no los nombra y no hay otra fuente.",
      "Fotos del evento: solo se conserva la portada de la crónica.",
      "Flyer o afiche.",
      "Cantidad de muestras y de participantes.",
      "Nombres del jurado.",
    ],
  },

  // ── 2ª · 2015 ─────────────────────────────────────────────────────────
  {
    anio: 2015,
    numero: 2,
    rotulo: "2ª",
    rotuloAlt: ["2da"],
    nombre: "2ª Copa Cata del Oeste",
    etapa: "grupo",
    fecha: "2015-07-11",
    diaSemana: "sábado",
    fechaFuentes: ["web-0187", "fb-2015-07-06"],
    horaInicio: {
      valor: "13:45",
      fuente: "web-0187",
      nota: "Inicio de la cata; la recepción de muestras empezó pasado el mediodía.",
    },
    lugar: NO_FIGURA,
    formato: [
      {
        texto: "Dos rondas de cata de dos muestras cada una, con un almuerzo en el medio.",
        fuente: "web-0187",
      },
      { texto: "Las muestras de hash se evaluaron en una cata aparte.", fuente: "web-0187" },
      {
        texto:
          "Además del campeón y un segundo puesto, hubo un premio del jurado, una mención de hash y seis menciones de mesa.",
        fuente: "web-0187",
      },
    ],
    categoriasTexto: {
      valor: null,
      fuente: "web-0187",
      nota: "La crónica no nombra categorías: publica un podio, un premio del jurado y menciones, entre ellas una de hash.",
    },
    muestras: SIN_DATO,
    participantes: SIN_DATO,
    cupo: SIN_DATO,
    mesas: { valor: 7, fuente: "web-0187" },
    entrada: SIN_DATO,
    marcas: {
      min: 10,
      max: 12,
      fuentes: ["web-0187", "fb-2015-07-06"],
      nota: "La crónica nombra 10; el anuncio del 06/07/2015 en Facebook, 12: las mismas 10 y dos más.",
    },
    jurado: null,
    palmares: { fuentes: ["web-0187"] },
    cronica: {
      autor: "Gato",
      fecha: "2015-07-22",
      wayback:
        "https://web.archive.org/web/20160409222559/http://cogollosdeloeste.com.ar/cws/codeloweb/article/187",
      fuente: "web-0187",
      resumen:
        "Recorre la jornada del sábado 11/07/2015: la recepción de muestras pasado el mediodía, dos rondas de cata en siete mesas, una cata aparte de hash y la entrega de premios. Publica la lista completa de ganadores y agradece a los comercios que aportaron premios.",
      cita: "Terminados los cómputos, nuestros ingenieros dieron el Ok para iniciar la entrega de premios.",
    },
    heroGrafica: "2015-flyer",
    fuentes: ["fb-2015-06-20", "fb-2015-07-06", "web-0187", "fb-album-2015"],
    contradicciones: [],
    faltantes: ["Lugar.", "Bases.", "Cantidad de participantes y de muestras.", "Nombres del jurado."],
  },

  // ── 3ª · 2016 ─────────────────────────────────────────────────────────
  {
    anio: 2016,
    numero: 3,
    rotulo: "3ª",
    rotuloAlt: ["3ra", "3º"],
    nombre: "3ª Copa Cata del Oeste",
    etapa: "constituida-sin-personeria",
    fecha: "2016-07-16",
    diaSemana: "sábado",
    fechaFuentes: ["afiche-2016", "web-0525", "fb-2016-07-16"],
    fechaNota:
      "El afiche no imprime el año: sale de la fecha de la convocatoria (24/06/2016) y de la publicación del mismo 16/07/2016.",
    horaInicio: { valor: "12:00", fuente: "afiche-2016" },
    lugar: NO_FIGURA,
    formato: [
      { texto: "Inscripción previa por correo, con capacidad limitada.", fuente: "afiche-2016" },
      {
        texto: "Las inscripciones se cerraron el 15/07/2016, la víspera, por cupo completo.",
        fuente: "fb-2016-07-15",
      },
      {
        texto: "Hubo un campeón general, dos puestos en Interior, dos en Exterior y cuatro menciones.",
        fuente: "fb-2016-07-19",
      },
    ],
    categoriasTexto: { valor: "Interior y Exterior", fuente: "fb-2016-07-19" },
    muestras: SIN_DATO,
    participantes: SIN_DATO,
    cupo: { valor: null, fuente: "afiche-2016", nota: "Capacidad limitada, sin número." },
    mesas: SIN_DATO,
    entrada: SIN_DATO,
    marcas: {
      min: 12,
      max: 12,
      fuentes: ["fb-2016-07-15", "fb-2016-07-19"],
      nota: "Las mismas 12 en el cierre de inscripciones y en la lista de ganadores.",
    },
    jurado: null,
    palmares: {
      fuentes: ["fb-2016-07-19", "fb-2016-07-18"],
      nota: "La lista se publicó dos veces con el mismo contenido: el 18/07/2016, con el álbum de fotos, y el 19/07/2016.",
    },
    cronica: null,
    heroGrafica: "2016-afiche",
    fuentes: [
      "web-0525",
      "afiche-2016",
      "fb-2016-07-15",
      "fb-2016-07-16",
      "fb-2016-07-18",
      "fb-2016-07-19",
      "fb-album-2016",
    ],
    contradicciones: [
      {
        tema: "Muestra n° 21",
        versiones: [
          { valor: "Es la del campeón", fuente: "fb-2016-07-19" },
          { valor: "Es la de la primera mención", fuente: "fb-2016-07-19" },
        ],
        nota: "La misma publicación le da el número a dos premios; uno de los dos está mal.",
      },
    ],
    faltantes: [
      "Lugar.",
      "Bases.",
      "Cantidad de participantes y de muestras.",
      "Crónica: solo se conserva la convocatoria.",
    ],
  },

  // ── IV · 2017 ─────────────────────────────────────────────────────────
  {
    anio: 2017,
    numero: 4,
    rotulo: "IV",
    rotuloAlt: [],
    nombre: "IV Copa Cata del Oeste",
    etapa: "constituida-sin-personeria",
    fecha: "2017-07-15",
    diaSemana: "sábado",
    fechaFuentes: ["afiche-2017", "entradas-2017", "fb-2017-06-29"],
    horaInicio: { valor: "12:00", fuente: "afiche-2017" },
    lugar: {
      valor: "CABA",
      fuente: "fb-2017-06-29",
      nota: "La convocatoria decía «en Capital Federal», sin dirección.",
    },
    formato: [
      {
        texto: "Nadie tenía su propia muestra en la mesa: cada participante respetaba la mesa asignada.",
        fuente: "ficha-cata-2017",
      },
      {
        texto:
          "Dos tandas de cata: de 13:00 a 14:30, con dos muestras, y de 15:30 a 17:30, con dos o tres más.",
        fuente: "ficha-cata-2017",
      },
      { texto: "Los participantes puntuaban las muestras en planillas.", fuente: "ficha-cata-2017" },
      { texto: "El cupo se completó el 14/07/2017, la víspera.", fuente: "fb-2017-07-14" },
      { texto: "La planilla registra 41 entradas vendidas y 25 invitados.", fuente: "planilla-2017" },
    ],
    categoriasTexto: {
      valor: "Interior y Exterior",
      fuente: "fb-2017-07-18",
      nota: "La publicación indica si cada muestra era de interior o de exterior, y suma una mención a la mejor presentación y un premio de extracciones.",
    },
    muestras: {
      valor: 55,
      fuente: "planilla-2017",
      nota: "La planilla anota 35 de ellas como «físicas».",
    },
    participantes: {
      valor: null,
      fuente: "planilla-2017",
      nota: "La planilla tiene dos versiones: 51 participantes entre 76 asistentes, o 56 entre 81.",
    },
    cupo: { valor: null, fuente: "afiche-2017", nota: "Capacidad limitada, sin número." },
    mesas: SIN_DATO,
    entrada: {
      valor: "$400",
      fuente: "entradas-2017",
      nota: "Con comida y bebida incluidas, según la convocatoria del 29/06/2017.",
    },
    marcas: {
      min: 15,
      max: 16,
      fuentes: ["afiche-2017", "fb-2017-07-18"],
      nota: "El afiche lleva 15 marcas; la publicación de ganadores agradece a 14 de ellas y a otro auspiciante que no está en el afiche.",
    },
    jurado: null,
    palmares: { fuentes: ["fb-2017-07-18"] },
    cronica: null,
    heroGrafica: "2017-afiche",
    fuentes: [
      "afiche-2017",
      "entradas-2017",
      "ficha-cata-2017",
      "planilla-2017",
      "fb-2017-06-29",
      "fb-2017-07-14",
      "fb-2017-07-15",
      "fb-2017-07-18",
      "fb-album-2017",
    ],
    contradicciones: [
      {
        tema: "Asistentes y participantes",
        versiones: [
          { valor: "76 asistentes, 51 de ellos participantes", fuente: "planilla-2017" },
          { valor: "81 asistentes, 56 de ellos participantes", fuente: "planilla-2017" },
        ],
        nota: "Las dos versiones están en la misma planilla: una pestaña y su copia.",
      },
      {
        tema: "Premios anunciados y publicados",
        versiones: [
          { valor: "Se premiaban los cinco primeros puestos", fuente: "ficha-cata-2017" },
          {
            valor: "Siete premios: campeón, segundo y tercer puesto, tres menciones y extracciones",
            fuente: "fb-2017-07-18",
          },
        ],
      },
    ],
    faltantes: ["Lugar exacto.", "Bases."],
  },

  // ── V · 2018 ──────────────────────────────────────────────────────────
  {
    anio: 2018,
    numero: 5,
    rotulo: "V",
    rotuloAlt: ["5ta"],
    nombre: "V Copa Cata del Oeste",
    etapa: "asociacion",
    fecha: "2018-07-22",
    diaSemana: "domingo",
    fechaFuentes: ["fb-2018-06-28", "carpeta-2018", "caja-2018"],
    fechaNota: "El cronograma del sitio anterior, del 08/06/2018, la anunciaba para el sábado 14/07/2018.",
    horaInicio: SIN_DATO,
    lugar: {
      valor: null,
      fuente: "fb-2018-07-23",
      nota: `La fuente da solo el nombre de un local, sin barrio, y le agradece abrir sus puertas «una vez más». ${NO_PUBLICAMOS}`,
    },
    formato: [
      {
        texto: "Las bases se mandaban por correo a quienes se inscribían; el cupo era limitado.",
        fuente: "fb-2018-06-28",
      },
      {
        texto: "Hubo premios en Interior, Exterior y extracciones, y una mención del jurado.",
        fuente: "fb-2018-07-23",
      },
    ],
    categoriasTexto: {
      valor: "Interior y Exterior",
      fuente: "inscriptos-2018",
      nota: "En la lista de inscriptos, dos personas compiten con rosin; la publicación de resultados premia extracciones.",
    },
    muestras: SIN_DATO,
    participantes: {
      valor: 28,
      fuente: "inscriptos-2018",
      nota: "Aproximado: unas 28 filas en la lista de inscriptos.",
    },
    cupo: { valor: null, fuente: "fb-2018-06-28", nota: "Cupo limitado, sin número." },
    mesas: SIN_DATO,
    entrada: SIN_DATO,
    marcas: {
      min: 20,
      max: 20,
      fuentes: ["ig-2018-07-17"],
      nota: "Cuentas de Instagram etiquetadas en el agradecimiento previo al evento.",
    },
    jurado: null,
    palmares: {
      fuentes: ["fb-2018-07-23"],
      nota: "La publicación anunciaba los puntajes finales, que no se publicaron después.",
    },
    cronica: null,
    heroGrafica: null,
    fuentes: [
      "web-0999",
      "fb-2018-06-28",
      "ig-2018-07-17",
      "fb-2018-07-23",
      "ig-2018-07-23",
      "carpeta-2018",
      "caja-2018",
      "inscriptos-2018",
    ],
    contradicciones: [
      {
        tema: "Fecha",
        versiones: [
          { valor: "Sábado 14/07/2018", fuente: "web-0999" },
          { valor: "Domingo 22/07/2018", fuente: "fb-2018-06-28" },
        ],
        nota: "El cronograma es del 08/06/2018. Desde el 28/06/2018 las publicaciones anuncian el 22/07/2018, que es también la fecha de la carpeta y de la planilla de caja.",
      },
    ],
    faltantes: [
      "Flyer o afiche.",
      "Bases.",
      "Puntajes finales.",
      "Precio de la entrada.",
      "Nombres del jurado.",
    ],
  },

  // ── VI · 2019 ─────────────────────────────────────────────────────────
  {
    anio: 2019,
    numero: 6,
    rotulo: "VI",
    rotuloAlt: ["6ta"],
    nombre: "VI Copa Cata del Oeste",
    etapa: "asociacion",
    fecha: "2019-07-14",
    diaSemana: "domingo",
    fechaFuentes: ["bases-2019"],
    horaInicio: {
      valor: "12:00",
      fuente: "bases-2019",
      nota: "Ingreso; la cata empezaba a las 12:45.",
    },
    lugar: {
      valor: "CABA",
      fuente: "bases-2019",
      nota: "La dirección se mandaba por correo el sábado 13/07/2019, la víspera, y no figura en ninguna fuente.",
    },
    formato: [
      {
        texto: "Solo para mayores de 18 años, con un máximo de dos muestras por participante.",
        fuente: "bases-2019",
      },
      {
        texto: "Cada participante podía sumar un acompañante, que no calificaba.",
        fuente: "bases-2019",
      },
      {
        texto:
          "Nadie evaluaba su propia muestra: cada participante tenía una mesa asignada, que recibía unas cinco muestras en tandas.",
        fuente: "bases-2019",
      },
      { texto: "Los participantes puntuaban las muestras en planillas.", fuente: "bases-2019" },
      {
        texto: "Hubo dos catas en paralelo: la de las mesas de participantes y la del jurado.",
        fuente: "bases-2019",
      },
      { texto: "En extracciones, el jurado hacía primero una preselección.", fuente: "bases-2019" },
    ],
    categoriasTexto: {
      valor: "Flores (Interior y Exterior) y extracciones",
      fuente: "bases-2019",
      nota: "Las bases dividían las extracciones en mecánicas y con solvente; la placa de resultados premia Rosin y Hash.",
    },
    muestras: { valor: 63, fuente: "planilla-2019", nota: "Numeradas del 1 al 63." },
    participantes: {
      valor: 62,
      fuente: "planilla-2019",
      nota: "Aproximado: unas 62 filas en la planilla.",
    },
    cupo: SIN_DATO,
    mesas: { valor: 10, fuente: "planilla-2019" },
    entrada: {
      valor:
        "$1.200 anticipada hasta el 30/06/2019, $1.350 con pago en línea y $1.500 en puerta; incluía el almuerzo",
      fuente: "bases-2019",
    },
    marcas: {
      min: 45,
      max: 45,
      fuentes: ["fb-2019-07-14-sponsors", "planilla-sponsors-2019"],
      nota: "La lista publicada la noche del evento coincide con la planilla interna.",
    },
    jurado: null,
    palmares: { fuentes: ["placa-menciones-2019"], nota: "La placa se leyó a ojo." },
    cronica: null,
    heroGrafica: "2019-logo",
    fuentes: [
      "fb-2019-06-18",
      "logo-2019",
      "bases-2019",
      "planilla-2019",
      "placa-menciones-2019",
      "placa-menciones-2019-b",
      "fb-2019-07-14-sponsors",
      "planilla-sponsors-2019",
      "fb-album-2019",
      "fb-video-2019",
      "ig-historias-2019",
      "ig-2019-07-19",
      "fotografo-2019",
    ],
    contradicciones: [
      {
        tema: "Premios anunciados y entregados",
        versiones: [
          {
            valor:
              "Siete: campeón, 1° y 2° de Interior y de Exterior, y un 1° de extracción mecánica y otro con solvente",
            fuente: "bases-2019",
          },
          {
            valor: "Trece: la campeona y tres puestos en Interior, Exterior, Rosin y Hash",
            fuente: "placa-menciones-2019",
          },
        ],
      },
      {
        tema: "Rosin, 1° puesto: ¿genética o muestra?",
        versiones: [
          { valor: "«R18» como nombre de la genética", fuente: "placa-menciones-2019" },
          { valor: "«R18» como número de muestra", fuente: "placa-menciones-2019" },
        ],
        nota: "La placa pone «R18» en el lugar de la genética. Las muestras de flores van numeradas como M45 o M36, así que puede ser un número de muestra.",
      },
      {
        tema: "Hash, 2° puesto: nombre",
        versiones: [
          { valor: "Sam", fuente: "placa-menciones-2019" },
          { valor: "Sami", fuente: "placa-menciones-2019-b" },
        ],
        nota: "La segunda versión se leyó de forma automática, sin revisarla a ojo.",
      },
    ],
    faltantes: ["Lugar exacto.", "Nombres del jurado.", "Afiche."],
  },

  // ── VII · 2021 ────────────────────────────────────────────────────────
  {
    anio: 2021,
    numero: 7,
    rotulo: "VII",
    rotuloAlt: ["7ª", "7ma"],
    nombre: "VII Copa Cata del Oeste",
    etapa: "asociacion",
    fecha: "2021-11-07",
    diaSemana: "domingo",
    fechaFuentes: ["bases-2021", "protocolo-2021", "fb-2021-10-07"],
    horaInicio: {
      valor: "12:00",
      fuente: "bases-2021",
      nota: "Ingreso; la cata empezaba a las 12:45.",
    },
    lugar: {
      valor: "CABA",
      fuente: "bases-2021",
      nota: `El lugar no se difundió: la dirección se mandaba por correo el sábado 06/11/2021, la víspera. ${NO_PUBLICAMOS}`,
    },
    formato: [
      { texto: "Volvió después de más de dos años sin Copa.", fuente: "fb-2021-10-07" },
      {
        texto: "Solo para mayores de 18 años, con un máximo de dos muestras por participante.",
        fuente: "bases-2021",
      },
      { texto: "Se hizo al aire libre, bajo una carpa.", fuente: "ig-historias-2021" },
      {
        texto:
          "Por la pandemia hubo protocolo sanitario: control de temperatura y sanitizante al ingreso y en las mesas.",
        fuente: "protocolo-2021",
      },
      {
        texto: "Hubo dos catas en paralelo: la de las mesas de participantes y la del jurado.",
        fuente: "bases-2021",
      },
      {
        texto:
          "Se sumó la categoría Grow, en la que competían los comercios de cultivo que acompañaban la Copa.",
        fuente: "protocolo-2021",
      },
      {
        texto:
          "Se sumó una mención al grow, dojo o crew donde aprendieron los participantes, para el de mejor promedio.",
        fuente: "bases-2021",
      },
      { texto: "Hubo charlas y un stand sobre reducción de daños.", fuente: "ig-videos-2021" },
    ],
    categoriasTexto: {
      valor: "Flores Interior, Flores Exterior, Rosin, Hash y Grow, más menciones",
      fuente: "bases-2021",
    },
    muestras: SIN_DATO,
    participantes: SIN_DATO,
    cupo: { valor: 100, fuente: "protocolo-2021" },
    mesas: SIN_DATO,
    entrada: {
      valor: "$4.000 anticipada y $4.500 en puerta, con precio especial para socios y otras organizaciones",
      fuente: "bases-2021",
      nota: "El precio para socios difiere entre las bases ($3.500) y el protocolo ($3.600): ver las contradicciones.",
    },
    marcas: {
      min: 33,
      max: 36,
      fuentes: ["placas-sponsors-2021", "fb-2021-11-06", "planilla-sponsors-2021"],
      nota: "33 en las placas publicadas y en el agradecimiento del 06/11/2021; la planilla interna suma 3 que no figuran en ninguna placa.",
    },
    jurado: {
      flores: ["Chirry", "DF", "Lúcia", "Tío Bob", "Nico", "Renata"],
      extracciones: ["Fasito", "Javi", "Carito", "Roxy"],
      fuente: "protocolo-2021",
    },
    palmares: {
      fuentes: ["fb-2021-11-10"],
      nota: "Las placas de ganadores se leyeron a ojo. La categoría Grow no tuvo placa: sale del texto de la publicación.",
    },
    cronica: null,
    heroGrafica: "2021-flyer",
    fuentes: [
      "fb-2021-10-07",
      "logo-2021",
      "flyer-2021",
      "entrada-2021",
      "bases-2021",
      "protocolo-2021",
      "fb-2021-11-06",
      "ig-historias-2021",
      "ig-videos-2021",
      "fb-2021-11-10",
      "placas-sponsors-2021",
      "planilla-sponsors-2021",
      "ig-reel-2021",
    ],
    contradicciones: [
      {
        tema: "Entrada para socios",
        versiones: [
          { valor: "$3.500", fuente: "bases-2021" },
          { valor: "$3.600", fuente: "protocolo-2021" },
        ],
      },
      {
        tema: "Plazo de la entrada anticipada",
        versiones: [
          { valor: "Hasta el 30/10/2021", fuente: "bases-2021" },
          { valor: "Hasta el 20/10/2021", fuente: "protocolo-2021" },
        ],
      },
    ],
    faltantes: [
      "Fotos del evento: solo hay historias y videos de Instagram.",
      "Cantidad de muestras y de participantes.",
      "Puntajes.",
    ],
  },

  // ── 8ª · 2022 ─────────────────────────────────────────────────────────
  {
    anio: 2022,
    numero: 8,
    rotulo: "8ª",
    rotuloAlt: ["8va", "VIII"],
    nombre: "8ª Copa Cata del Oeste",
    etapa: "asociacion",
    fecha: "2022-07-17",
    diaSemana: "domingo",
    fechaFuentes: ["flyer-2022", "ig-2022-07-17", "ig-historias-2022"],
    horaInicio: { valor: "12:00", fuente: "flyer-2022" },
    lugar: NO_FIGURA,
    formato: [
      { texto: "Volvió a la fecha habitual de julio.", fuente: "ig-2022-05-30" },
      { texto: "Hubo preselección de las muestras que iban a competir.", fuente: "ig-2022-05-30" },
      { texto: "La convocatoria invitó en especial a mujeres y disidencias.", fuente: "ig-2022-05-30" },
      {
        texto:
          "El 18/06/2022 hubo una cata de preparación, abierta con una charla sobre cómo presentar una muestra para competir.",
        fuente: "fb-2022-06-08",
      },
      {
        texto: "El reel de cierre, del 09/08/2022, anunció una 9ª edición para julio de 2023.",
        fuente: "ig-reel-2022",
      },
      { texto: "La 9ª no se hizo: esta fue la última Copa.", fuente: "secretaria-2026-10-06" },
    ],
    categoriasTexto: {
      valor: "Interior, Exterior, Rosin Hash, Rosin Flor, Hash y Grow, más menciones",
      fuente: "fb-2022-07-20",
    },
    muestras: SIN_DATO,
    participantes: SIN_DATO,
    cupo: { valor: 100, fuente: "protocolo-2022" },
    mesas: SIN_DATO,
    entrada: { valor: "$7.000; anticipada, $6.500; socios, $6.000", fuente: "protocolo-2022" },
    marcas: {
      min: 34,
      max: 34,
      fuentes: ["ig-2022-07-17", "planilla-sponsors-2022"],
      nota: "Las 34 cuentas que agradece la publicación del día del evento coinciden con la planilla interna.",
    },
    jurado: {
      flores: ["Gustavo", "DF", "Lúcia", "Tío Bob", "Nico", "Renata"],
      extracciones: ["Fasito", "Javi", "Carito", "Roxy"],
      fuente: "protocolo-2022",
      nota: "El protocolo cierra la lista de extracciones con «Roxy» y otra palabra, sin coma: puede ser una persona o dos, y la segunda palabra puede ser un apellido.",
    },
    palmares: { fuentes: ["fb-2022-07-20", "ig-2022-07-20"] },
    cronica: null,
    heroGrafica: "2022-flyer",
    fuentes: [
      "ig-2022-05-30",
      "fb-2022-06-08",
      "flyer-2022",
      "protocolo-2022",
      "cartas-sponsors-2022",
      "planilla-sponsors-2022",
      "ig-2022-07-17",
      "ig-historias-2022",
      "fb-2022-07-20",
      "ig-2022-07-20",
      "ig-reel-2022",
      "fb-2021-11-10",
      "secretaria-2026-10-06",
    ],
    contradicciones: [
      {
        tema: "Fecha",
        versiones: [
          { valor: "Domingo 17/07/2022", fuente: "flyer-2022" },
          { valor: "«Domingo 19 de julio de 2022»", fuente: "protocolo-2022" },
        ],
        nota: "El 19/07/2022 fue martes. Las historias y la publicación de Instagram del mismo 17/07/2022 confirman el domingo 17.",
      },
      {
        tema: "Número de edición",
        versiones: [
          { valor: "8va", fuente: "flyer-2022" },
          { valor: "VII", fuente: "cartas-sponsors-2022" },
        ],
        nota: "Las cartas arrastran el texto de la plantilla de 2021.",
      },
      {
        tema: "Exterior, 4° puesto: banco de la genética",
        versiones: [
          { valor: "Serious Seeds", fuente: "fb-2022-07-20" },
          { valor: "Delicious Seeds", fuente: "ig-2022-07-20" },
        ],
      },
      {
        tema: "Mención Jurado: genética",
        versiones: [
          { valor: "«Mac&Diré», como se publicó", fuente: "fb-2022-07-20" },
          { valor: "«Mac & Fire», la Mejor Planta de 2021, del mismo banco", fuente: "fb-2021-11-10" },
        ],
        nota: "Puede ser un error de tipeo; ninguna otra fuente lo aclara.",
      },
      {
        tema: "Cantidad de premios",
        versiones: [
          { valor: "22 menciones", fuente: "ig-2022-07-17" },
          { valor: "23 premios", fuente: "fb-2022-07-20" },
        ],
        nota: "La publicación del día del evento anunciaba 22; la lista de ganadores tiene 23.",
      },
    ],
    faltantes: ["Lugar.", "Bases.", "Cantidad de muestras y de participantes.", "Puntajes."],
  },
];
