# /archivo — Archivo histórico

> Archivo de página: para `/archivo` y para el bloque «Del archivo» de la home,
> estas reglas **mandan sobre** `codelo-—-cogollos-del-oeste/MASTER.md`. Lo que
> no está acá sigue al MASTER: papel, Dos Tintas, las cuatro tipografías, el
> piso de contraste y de accesibilidad.

**Qué es:** el índice de lo que la asociación escribió, grabó y contó en su
sitio anterior entre 2014 y 2021 —crónicas de talleres y de la Copa,
entrevistas, un informe, pronunciamientos—, más las notas nuevas que cuentan
esa historia (la cronología 2014–2017 y la investigación sobre los monos de
Heath). Cada nota vive en el CMS como `post`, con la etiqueta `historico` y, las
viejas, con su fecha original; se lee en `/blog/<slug>`. Esta página no muestra
texto de las notas: las ordena y las presenta.

---

## De dónde salen los datos

`lib/vertical/archivo/notas.ts` es un **manifiesto generado**, como los medios
de la Copa: lo escribe `salidas/web-vieja/_import/generar_manifiesto.py` (repo
de secretaría) a partir de `notas.json`, los borradores de las notas nuevas y,
cuando existe, `importadas.json`, el estado que deja la importación al CMS. No
se edita a mano: se corre el script y se versiona lo que escribe.

```sh
python3 salidas/web-vieja/_import/generar_manifiesto.py            # el manifiesto
python3 salidas/web-vieja/_import/generar_manifiesto.py --portadas # + las ilustraciones
```

- Antes de importar, sale igual: slugs de `notas.json` y de los borradores, y la
  ilustración de archivo de cada tipo. Una nota nueva sin importar lleva la
  fecha de hoy, avisada como provisional.
- Después de importar, se vuelve a correr: toma el slug final y, de cada nota
  que la importación dio por verificada, la portada del CMS (y la fecha de
  publicación de las nuevas).
- **El texto alternativo es el de la imagen**, no el del tipo: sale del CMS
  (`portada.alt` en `importadas.json`, el `alternativeText` que subió
  `importar.py`); si faltara, del `portada_alt` de `_fuentes/NNNN.md`; y si
  también faltara, el de la ilustración del tipo, pero solo cuando la imagen
  ES la del tipo (la misma URL que `medios["archivo-<tipo>"]`). Una lámina
  propia sin texto alternativo frena el generador: el del tipo describe otro
  dibujo. Así había quedado la 277 —«un grabador de casete»— cuando su lámina
  es un maletín de médico.
- Valida antes de escribir —slugs únicos, ids viejos únicos contando los
  fusionados, fechas ISO en hora de Argentina, textos sin `@` ni enlaces, un
  texto alternativo por imagen (la misma imagen no lleva dos y dos imágenes no
  comparten uno)— y si algo no pasa no escribe nada. `datos.test.ts` vigila lo
  mismo del lado del sitio, y además que ninguna lámina propia lleve el texto
  de una ilustración de tipo. Para saber qué dibujo es cada una sin mirar su
  texto usa el nombre que les pone la importación en el CMS: `archivo_<tipo>_…`
  es la ilustración de un tipo, `archivo_<NNNN>_…` la lámina propia de la nota
  NNNN. Un nombre que no siga esa forma hace fallar el test.

Lo que el sitio calcula (agrupar por año, el filtro, las tres de la home,
adónde va una URL vieja) son funciones puras en `stats.ts`, con tests.

---

## Composición

Una sola columna de 1400 px, con la estructura de una revista: arriba lo
destacado, abajo el índice. El encabezado de Entrevistas y el año por año usan
la grilla `4fr / 8fr`: a la izquierda lo que nombra (el título, el año), a la
derecha lo demás; en el año por año la columna del año queda fija mientras la
lista corre.

1. **Cabecera.** Ceja en ocre («El sitio de antes · 2014–2021»), el título en
   la egipcia grande y una bajada corta. El rango de años sale de los datos.
2. **Índice por tipo.** Una fila de celdas con la cifra grande y el rótulo
   («21 Todo · 9 Entrevistas · 7 Crónicas · 1 Informe…»), separadas por
   filetes. Es también el **filtro**: cada celda es un enlace a
   `/archivo?tipo=<tipo>`, sin JS y compartible; la activa lleva el filete
   ámbar de 3 px arriba y `aria-current`. Un tipo con una sola nota va en
   singular. Un `?tipo=` desconocido muestra todo; el canonical es siempre
   `/archivo`.
3. **Sin filtro:**
   - **Nuevo en el archivo** (si hay notas nuevas): grandes, con su lámina a
     16:9, título, bajada y firma.
   - **Entrevistas:** una grilla a todo el ancho, tres columnas en escritorio y
     dos en tableta; cada charla con su lámina a 16:9 arriba y, debajo, la
     fecha, el título —casi siempre una cita—, la bajada (tres líneas) y la
     firma *entrevistador → entrevistado*. Sin tarjetas: cada ficha se apoya en
     un filete fino, como las columnas de un diario. En el teléfono es una
     lista, con la lámina a 4:3 y 7rem al costado y sin bajada.
   - **El resto, año por año:** el encabezado nombra lo que hay («Crónicas,
     informes y pronunciamientos», armado con los tipos presentes); cada año en
     ocre grande, con cuántas notas tiene; cada nota con su lámina a 4:3, el
     rótulo *tipo · dd/mm/aaaa*, el título, la bajada y la firma.
4. **Con filtro:** todo lo del tipo, año por año, con la misma ficha y cada una
   con su lámina (`?tipo=entrevista` también: el filtro es índice, no
   vidriera). Si todas compartieran la lámina —un tipo sin láminas propias, o
   antes de importar, cuando cada nota lleva la de su tipo— va una sola en el
   encabezado de la lista y las fichas quedan sin imagen.

**Entrevistador → entrevistado.** El entrevistado lo extrae el generador del
título o de la bajada, tal como está escrito (con su «Dr.», o con las comillas
de un apodo); si la nota no lo nombra, queda `null` y va solo «Por …». Nunca se
completa. La flecha es visual (`aria-hidden`); el lector de pantalla oye
«Entrevista a Franco, por Santiago».

---

## Las láminas

Grabados a dos tintas (tinta y ámbar del logo) sobre papel, sin personas y sin
texto, en dos familias:

- **La propia de cada nota** (decisión del 07/10/2026): un motivo por tema —el
  maletín de médico de Morante, el sombrero de pirata, la computadora de los
  noventa de Leo, la balanza, el microscopio, la máquina de extracción, el
  Congreso con banderas de la Marcha 2016, el ropero con flores del Orgullo—.
  Viven solo en la Media Library (`/cms/uploads/archivo_NNNN_….webp`) y llegan
  por el manifiesto, cada una con su texto alternativo.
- **La de su tipo**, para las que no tienen una propia: el informe 869, el
  pronunciamiento 1145, la cronología y Heath (que tiene la suya desde el
  principio). Son seis, en `lib/vertical/archivo/ilustraciones.ts` y
  `public/archivo/portadas/`, y son también el respaldo de cualquier nota
  mientras no está importada.

Las tres fotos propias (notas 10, 34 y 187) van con el duotono de la casa
(`.cover-treatment`), para que no rompan la serie de grabados.

Cómo se imprimen (`.archivo-lamina`, `vertical.css`):

- **En claro, sobre el papel de la página**: `mix-blend-mode: darken` deja que
  el papel de la lámina tome el color de la página y quedan el trazo y el
  ámbar. Los bordes se apagan con una máscara del 10 % por lado
  (`--lamina-borde`): ahí el papel viejo está manchado y oscurecido, y con el
  6 % que alcanzaba para las de tipo, las láminas nuevas dejaban ver su
  rectángulo. Dos tienen el papel más tostado que la página (la 441 y la 1102)
  y quedan como un grabado sobre pergamino, con el borde fundido.
- **La mezcla necesita ver el papel de la página.** Un ancestro que arme su
  propio contexto de apilamiento (sticky, contenedor de consultas, opacidad,
  transform) la corta y la lámina vuelve a mostrar su papel: pasaba con la
  lámina fija de la versión anterior de Entrevistas, que estaba dentro de una
  columna sticky. Si hace falta un contenedor así, que lleve `bg-background`,
  como el bloque de la home.
- **En oscuro, como lámina impresa**, con su papel y un punto menos de brillo,
  como las láminas de la casa. Se probó el negativo (invertir y girar el tono) y
  cambiaba el dibujo: la ventana de noche de la lámina de Heath pasaba a ser de
  día.
- **Recorte de imprenta del 2,5 % por lado**, en los dos temas (`scale(1.05)`
  fijo, no un efecto). Cuatro láminas propias (11, 441, 991 y 1009) son el
  escaneo de una tarjeta sobre blanco, con hasta 1,1 % de margen blanco y el
  canto roto detrás: de noche se veía como un marco.
- **Una lámina por ficha.** Ya no se repite un mismo dibujo en una lista, así
  que cada ficha lleva el suyo. Si alguna vez una lista entera compartiera la
  lámina, va una sola (ver el filtro y la home): se probaron tres recortes de un
  mismo dibujo y se leían como el mismo dibujo cortado.
- **`alt=""` dentro de los enlaces.** El enlace ya nombra la nota (fecha,
  título, firma) y la lámina la ilustra sin agregar nada que haga falta para
  elegirla; leerle al lector de pantalla la descripción del dibujo antes del
  título solo alarga cada enlace. La descripción de cada imagen está en el
  manifiesto y en el CMS, que la usa en `/blog/<slug>`.
- **Peso.** Pasan por el optimizador de Next con `sizes` ajustado al ancho real
  de cada columna (420 px en la grilla de entrevistas, 192 en el año por año,
  112 en las miniaturas del teléfono). Carga perezosa salvo la primera de
  «Nuevo en el archivo», que es la imagen grande del primer pliegue en
  escritorio y va con `preload`. A 1440 px y densidad 1 la página entera baja 21
  imágenes y unos 280 KB.

---

## La home: «Del archivo»

`components/vertical/archivo/ArchivoHome.tsx`, en la columna principal, debajo
de la ventana de la Copa. Rótulo de sección con filete ámbar, «Entrar al
archivo», la bajada y **tres entrevistas: una por entrevistador, la más
reciente de cada uno** (voces y años distintos; si no hay tres entrevistadores,
se completa con las más recientes). Si el manifiesto no tiene entrevistas, el
bloque no se muestra.

Cada una lleva su lámina, y las tres van **en fila**: la lámina a 16:9 arriba,
el rótulo *Entrevista · año*, la cita y la firma, como la grilla de
`/archivo`. La fila depende del ancho del bloque y no del de la pantalla
(consulta de contenedor, `@min-[42rem]`): la columna principal mide 878 px a
1440, 623 a 1024 —con el riel al lado— y todo el ancho en tableta. Con menos de
42rem es una lista con la lámina al costado (7rem, 10rem desde 30rem de
bloque). El contenedor lleva `bg-background` porque arma su propio contexto de
apilamiento y las láminas, en claro, necesitan ver el papel (ver arriba).

Si las tres compartieran la ilustración (antes de importar), va una sola al
costado de la lista.

**La portada no muestra notas del sitio viejo** ni en el carrusel ni entre las
últimas: la home saca de lo que trae del CMS los slugs del manifiesto con
`viejoId` (`SLUGS_VIEJOS`), y pide de más para no achicarse. Protege la
portada mientras se importa, cuando una nota de 2015 recién publicada tiene la
hora del momento. Las nuevas sí pueden aparecer.

---

## Las URL del sitio anterior

El sitio viejo publicaba en `/cws/codeloweb/article/<id>`, y esas direcciones
siguen enlazadas desde afuera. `app/[lang]/(vertical)/cws/[[...ruta]]/route.ts`
las manda con 308 a `/blog/<slug>` si el id es de una nota del archivo (o quedó
fusionado en una: la 987 y la 989 van a la 985) y a `/archivo` cualquier otra
cosa de `/cws/`.

El middleware de idioma (`proxy.ts`, del motor) atiende antes: la URL vieja
llega sin `/es` y sale con un 307 a `/es/cws/…`, y recién ahí entra la ruta.
Son dos saltos y el primero es temporal. Para que fuera uno solo y permanente,
la redirección tendría que estar en `next.config.ts` (corre antes del
middleware), que es del motor: queda anotado como pedido para Nib.

---

## Tono

El mismo que la Copa: descontracturado, rioplatense, información y no dudas.
Sin notas de método, sin advertencias, sin hablar de lo que falta. Las notas se
cuentan como historia de la asociación, nunca como agenda. Los textos de la
interfaz están en `messages/es.vertical.json` → `archivo`, con las cifras por
parámetro.
