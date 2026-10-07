# /copa-cata — Noche cósmica

> Archivo de página: para `/copa-cata` (portada, cada edición y el palmarés)
> estas reglas **mandan sobre** `codelo-—-cogollos-del-oeste/MASTER.md`. Lo que
> no está acá sigue al MASTER: las cuatro tipografías y sus roles, la paleta
> del logo, el piso de contraste y de accesibilidad.

**Dirección:** "Noche cósmica", elegida por la Secretaría el 06/10/2026.
**Por qué:** la versión anterior era Dos Tintas pura —filetes, placas, fichas
con fuentes numeradas— y se leía como un expediente. La Copa fue una fiesta de
la comunidad y del cultivo: la sección la cuenta como celebración, en un tono
descontracturado, y el diseño acompaña con una atmósfera propia.

---

## La noche como lienzo

La sección es de noche **en los dos temas del sitio**. No es el modo oscuro:
es un lugar. La cabecera y el pie del sitio no cambian; todo lo que va entre
los dos vive en `<main class="copa-noche">` (`app/[lang]/vertical.css`, bloque
NOCHE).

`.copa-noche` **redefine los tokens del tema solo para lo que tiene adentro**
(`--background`, `--foreground`, `--muted-foreground`, `--card`, `--rule`,
`--primary`, `--sun`, `--ember-texto`, `--data-copa-*`…). Los componentes, y
las primitivas de los gráficos, siguen usando los nombres de siempre y quedan
sobre la noche sin saberlo. Por eso no hay que escribir `dark:` en ningún
componente de la sección.

| Token | Valor | Contraste sobre la noche / sobre `--card` |
| --- | --- | --- |
| `--background` | `oklch(0.165 0.066 268)` ≈ `#040a2a` | — |
| `--foreground` (papel) | `oklch(0.94 0.03 82)` | 16,3 / 14,9 |
| `--muted-foreground` (gris cálido) | `oklch(0.78 0.035 80)` | 9,6 / 8,8 |
| `--ember-texto` (ocre) | `oklch(0.762 0.124 52)` | 8,8 / 8,1 |
| `--sun` / `--primary` (ámbar) | `oklch(0.842 0.112 76)` | 11,8 / 10,8 |
| `--card` | `oklch(0.21 0.06 268)` | — |
| `--rule` | papel al 16 % | — |

**De dónde sale la noche:** es la tinta de las ilustraciones de la sección, un
punto más clara (rgb 4 10 42 contra la mediana rgb 2 6 36 de sus fondos). Ese
punto es el que permite imprimirlas con `lighten` (ver abajo).

**Luz:** un halo ámbar baja desde arriba de la página (el sol del logo, el único
gradiente permitido) y abajo la noche se cierra en la tinta del pie, para que
no quede un escalón contra la banda del sitio. `-mb-24` en el `<main>` anula el
`mt-24` del pie: la noche apoya directo sobre él.

**El cielo:** `estrellas.webp`, un campo que se repite sin cortes, en dos capas
(`::before` y `::after` del `<main>`) que titilan a destiempo. La opacidad tiene
**techo**: el titilar llega a **0,13**, y en reposo (movimiento reducido) las
capas quedan fijas en 0,14 y 0,10. Con eso el texto más chico (ocre o gris)
sigue en 4,5:1 o más aun con dos estrellas en su pico justo detrás, también
bajo el halo. Medido con las estrellas fijas en el pico, el peor píxel detrás
del texto del encabezado (portada y 2019, a 1440 y a 375 px): ceja 4,79 ·
título 5,91 · bajada 5,39; en la ventana de la home: ceja 6,63 · título 10,16 ·
bajada 5,14. El pico era 0,16 y bajó el 06/10/2026: con dos estrellas juntas,
un píxel de la bajada de la ventana daba 4,31:1. En reposo esa bajada da 5,44.

**Tintas de dato:** los pasos oscuros de `theme.css` (`#ce773e`, `#6977d3`,
`#ac4278`), revalidados sobre `#040a2a` con el validador del skill de dataviz,
todos los pares: CVD peor par ΔE 14,2, visión normal 18,2, contraste 5,85 /
4,79 / 3,52. Si se cambia la noche, revalidar.

---

## Las ilustraciones

Generadas para la sección por el paso `08_ilustraciones.py` del repo de
secretaría: dos tintas —ámbar y papel— sobre la noche, sin personas, sin texto
y sin logos. Rutas, medidas y `alt` en `lib/vertical/copa-cata/ilustraciones.ts`.

| Archivo | Uso |
| --- | --- |
| `portada.webp` (16:9) | Portada a sangre, con el título apoyado en su fundido |
| `edicion-AAAA.webp` (4:5) | Encabezado de cada edición, tiles del riel, vecinas |
| `orbitas.webp` (banda) | Separador entre bloques |
| `jardin.webp` (banda) | Cierre de cada página, pegado al pie |
| `estrellas.webp` (1:1, mosaico) | El cielo de fondo |

- **Se imprimen, no se pegan.** Van con `mix-blend-mode: lighten`
  (`.copa-arte`, `.copa-ornamento`): todo lo que en la imagen es más oscuro
  que la página toma el color de la página y el rectángulo desaparece; quedan
  el trazo y las estrellas del fondo pasan por detrás. `screen` no sirve: la
  tinta de las imágenes no es negra y `screen` la aclara (una franja azul).
- **La mezcla va en el contenedor**, el que lleva la máscara o la animación, y
  no en la `<img>`: máscara, `transform` y `z-index` arman un grupo aislado, y
  una imagen que se mezcla adentro no ve la página.
- **Se apagan en los bordes** (`.copa-fundido`, `.copa-fundido-abajo`) en vez
  de cortarse.
- **El texto nunca va sobre la ilustración plena.** En la portada, el título
  se apoya en la última franja del fundido, donde la imagen ya casi no está
  (medido arriba).
- Las tarjetas para compartir leen copias en jpg (`public/copa-cata/og/`), al
  tamaño exacto de la tarjeta: satori no lee webp. La de la portada pasa por un
  filtro de mediana de 3 px —borra el grano de risografía, que a 600 px no se
  ve y es lo que más pesa en el PNG— y queda en 271 KB, debajo del techo de
  300 KB de WhatsApp.

---

## Composición: menos estructura, más aire

- **Nada de filetes de sección ni placas.** Los bloques se separan con aire,
  con las bandas ilustradas y con un título grande (`TituloSeccion`: la egipcia
  con una estrella ámbar adelante).
- **Rieles** (`Riel.tsx`, `.copa-riel`): filas que se deslizan y frenan en
  cada pieza (scroll-snap). Las ediciones de la portada, los videos y las
  piezas gráficas de cada edición. Corren hasta el borde de la pantalla y la
  primera pieza arranca alineada con el texto (`--riel-margen`). En
  escritorio, flechas a la altura del título del bloque, que aparecen solo si
  la fila desborda y se apagan en las puntas (flotan: no corren la fila al
  aparecer); en el teléfono, el dedo.
- **Mosaico** para las fotos: columnas CSS que respetan la proporción de cada
  una (hasta cinco en pantallas anchas, nunca más columnas que fotos), en el
  duotono suave de la casa, y el visor de siempre (en color, con teclado).
- **Chips** para los datos de una edición: solo lo que se sabe; un dato sin
  valor no aparece.
- **El podio**: el premio mayor en grande, con su halo; el resto compacto,
  agrupado por categoría.
- **Navegación propia** (`CopaNav`): píldoras; la página activa se enciende.

---

## La ventana de la home

`CopaCataHome.tsx` abre la noche dentro de la portada del sitio, en la columna
principal y después de las notas, en los dos temas: es `.copa-noche` —los
mismos tokens y el mismo cielo— más `.copa-ventana`, que cambia solo el marco
(filete y esquinas) y la vuelve contenedor de consultas. Todo lo que dice sale
de los datos y los textos de la sección; `bajadaHome` es la primera frase de la
bajada de la portada.

- **El texto nunca va sobre el arte.** La ilustración va arriba, apagada hacia
  abajo, y la ceja, el título y la bajada van después, sobre la noche lisa.
  Montada sobre el fundido, como en la portada de la sección, la ceja caía
  sobre estrellas y órbitas del dibujo y bajaba a 2,4:1 (768 px) y 3,4:1
  (1440).
- **La tira responde a la ventana, no a la pantalla** (`.copa-tira`,
  `@container copa-ventana`), porque la ventana mide distinto según la columna
  que le toque: angosta es un riel con el dedo y deja asomar la tercera
  edición; desde 40rem las piezas crecen; desde 50rem las ocho entran en una
  fila fija y el riel no dibuja flechas.

---

## Qué se permite acá y en el resto del sitio no

| Acá sí | Por qué | Sigue prohibido |
| --- | --- | --- |
| **Brillo ámbar** en hover y en foco (`.copa-brillo`), halo en cifras y en el premio mayor (`.copa-luz`, `.copa-halo`) | En la noche la luz es el acento: lo que en el papel es un filete, acá se enciende | Sombras grises; hover que levanta o agranda; zoom en imágenes |
| **Esquinas blandas** (`--radius: 0.5rem` local; píldoras en navegación y botones) | Manda la órbita, no la imprenta | Tarjetas con sombra |
| **Gradientes de luz**: el halo ámbar de arriba, el cierre hacia la tinta | Son el sol y la noche del logo | Gradientes de color ajenos a la paleta |
| **Movimiento sutil**: estrellas que titilan, la ilustración que flota 10 px | Da vida sin pedir atención | Cualquier animación con `prefers-reduced-motion: reduce` (todo va bajo `no-preference`) |
| **Ilustraciones con la planta** en la portada, el encabezado y los separadores | Es la sección del material histórico: la Copa se cuenta sin tabú (decisión del 06/10/2026) | Personas reconocibles, apellidos, cuentas personales; marcas en el texto |

La pieza de la época que acompaña a la ilustración en el encabezado de cada
edición (afiche o flyer, apenas girada) lleva una sombra en la tinta de la
noche, no gris: es papel apoyado sobre el cielo, quieto, no una tarjeta que
flota al pasar el mouse.

El foco siempre es visible: contorno ámbar de 2 px con separación de 3 px
(11,8:1 sobre la noche), además del halo.

---

## Tono

Descontracturado y rioplatense, con aire de noche y de cosecha —la ronda, la
tribu, el cielo, las órbitas— sin ponerse cursi, y siempre como celebración de
la comunidad y del cultivo; nada que invite a consumir ni convoque. Se cuenta
como información, no como duda: sin advertencias, sin notas de método, sin
fuentes a la vista y sin hablar de lo que no pasó. Los datos y su procedencia
siguen en el código (`ediciones.ts`, `fuentes.ts`); los textos, en `textos.ts`,
con las cifras por parámetro. `textos.test.ts` vigila las dos cosas.
