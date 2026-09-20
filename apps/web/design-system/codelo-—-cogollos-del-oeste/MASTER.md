# Design System Master File — Dos Tintas

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Proyecto:** codelo — Cogollos del Oeste
**Dirección:** Dos Tintas (serigrafía a dos colores sobre papel)
**Referencia estructural:** theverge.com
**Reemplaza a:** una dirección previa "Organic Biophilic" (verde bosque + Newsreader)
que se descartó por genérica — ver *Historia* al final.

---

## De dónde sale todo: el logo

La paleta **no se eligió de un catálogo**: se muestreó del logo real
(`public/icons/logo.png`), un círculo con silueta vectorial plana de cannabis
contra un sol de atardecer. Muestreo sobre 20.983 píxeles del círculo:

| Muestra | Hex | Presencia |
| --- | --- | --- |
| Tinta (azul-negro) | `#00001C` | 34,6 % |
| Sol (ámbar) | `#E4B569` | 34,2 % |
| Brasa (ocre) | `#D89457` | 22,0 % |

Los dos hallazgos que definen el sistema:

1. **El "negro" del logo no es negro**: es `#00001C`, un azul-negro (0,0,28).
   Usar negro neutro rompe la relación con la marca.
2. **Es una impresión a dos tintas**, no una foto: dos colores planos sobre
   papel. De ahí sale todo lo demás.

---

## Color

### Constantes de marca (NO se invierten con el tema)

```css
--brand-ink:   #00001c;
--brand-sun:   #e4b569;
--brand-paper: #f6e6cc;
```

Las usan el **duotono** de portadas y la **banda del pie**. Son tratamientos de
impresión, no superficies de interfaz: seguir el tema los rompe. Un bug real:
cuando `.duotone` usaba `var(--ink)` —que sí se invierte— en modo oscuro la
imagen quedaba con `screen` sobre fondo claro, se saturaba a blanco y el velo
ámbar la tapaba.

### Tokens de tema

| Rol | Claro | Oscuro |
| --- | --- | --- |
| `--background` | `oklch(0.931 0.039 80)` — papel `#F6E6CC` | `oklch(0.165 0.042 275)` |
| `--foreground` | tinta `oklch(0.145 0.045 275)` | papel `oklch(0.93 0.015 78)` |
| `--primary` | la tinta | ámbar |
| `--ember` / `--cta` | ocre `oklch(0.715 0.113 52)` | ocre claro |
| `--sun` | ámbar `oklch(0.807 0.104 76)` | ámbar |
| `--rule` | tinta al 18 % | papel al 16 % |
| `--radius` | `0.125rem` — casi cero, registro de imprenta | idem |

**El papel es deliberadamente saturado.** Croma `0.039` contra `0.010` del
crema genérico que usa el diseño generado por IA (`#F4F1EA`): casi 4× más. Es
un tinte del ámbar del logo mezclado al 34 % sobre blanco, no un crema neutro.

**Regla de las dos tintas:** todo lo destacable va en la segunda tinta —
capitulares, viñetas, citas, enlaces, rótulos de sección, atribución de
organizador. Es lo que hace una impresión a dos colores.

### Tintas de dato (gráficos)

```css
--data-rnc:  #b96831;  /* claro */   #ce773e;  /* oscuro */
--data-rnpc: #525ca1;  /* claro */   #6977d3;  /* oscuro */
```

Los gráficos necesitaban dos series distinguibles y las dos salen de la marca,
sin traer un color ajeno: el ocre del logo, y **la misma tinta pero abierta**.
Que el "negro" de codelo sea azul (hue 275) es lo que lo hace posible — abrirlo
da un hue a **199° del ocre**, separación de sobra, mientras que ocre y ámbar
están a 24° y colapsan.

**Significado fijo en todo el sitio:** ámbar = RNC (comercialización), tinta =
RNPC (propiedad). El color sigue a la entidad, nunca al orden ni al valor. Un
gráfico de una sola serie usa el ámbar.

Los pasos **no se eligieron a ojo**: salen del validador del skill de dataviz.
Claro sobre papel `#f6e6cc` → CVD ΔE 20.3, visión normal 24.0, contraste ≥3:1.
Oscuro sobre `#090c20` → ΔE 23.1 / 25.7 / ≥3:1. Dos cosas que el validador
obligó y que a ojo no se ven:

- **El ocre de dato es más oscuro que `--ember`.** El ocre de interfaz da 2.13:1
  sobre el papel: alcanza para un enlace, no para una superficie de dato.
- **Los pasos oscuros están elegidos, no invertidos.** La banda de luminosidad
  del modo oscuro (L 0.48–0.67) es distinta de la clara, y el ocre claro se sale
  por arriba.

Si se agrega una tercera serie, revalidar — no estirar la paleta a ojo.

---

## Tipografía — cuatro roles

| Rol | Familia | Dónde |
| --- | --- | --- |
| **Marca** | Big Shoulders, versalitas, extrabold | SOLO "COGOLLOS DEL OESTE" (cabecera y pie) |
| **Display** | Zilla Slab (egipcia) | `h1`–`h4` |
| **Lectura** | Literata | cuerpo, bajadas, descripciones |
| **Etiqueta** | IBM Plex Mono | metadata, secciones, fechas, normas |

Se cargan con `next/font` en `app/[lang]/layout.tsx` y se mapean en
`globals.css` (`--font-wordmark`, `--font-display`, `--font-serif`, `--font-mono`).

**Por qué una egipcia y no un serif de alto contraste:** el serif elegante es
uno de los tres *looks por defecto* del diseño generado por IA. La egipcia
pertenece al mundo de la imprenta y rima con las dos tintas.

**Por qué la condensada solo en la marca:** toda la audacia tipográfica se
gasta en un lugar. Como display competía con la Literata y volvía el conjunto
tabloide.

La clase `.label` encapsula el rol de etiqueta: mono, 11 px, versalitas,
tracking `0.14em`.

---

## Firma: portadas en duotono PARCIAL

```css
filter: grayscale(0.55) contrast(1.5) brightness(1.06) saturate(1.15);
/* + velo var(--brand-sun) en multiply al 45 % */
```

Es el elemento por el que se reconoce el sitio. No es decoración:

1. **Unifica** portadas generadas por IA que si no parecen banco de imágenes suelto.
2. **Abstrae** la fotografía, lo que juega a favor de la regla editorial de no
   mostrar caras ni consumo.

**Parcial, no pleno — y esto importa.** El duotono al 100 % unificaba, pero
dejaba el sitio apagado: saturación media 0,30 y todo en una sola banda de
color. Al 55 % de gris con velo al 45 %: saturación 0,673 y rango dinámico 222.
Las portadas siguen siendo de la misma familia y el sitio respira.

---

## Estructura

Derivada de The Verge, adaptada:

- **Home:** columna de features (2,1fr) + **riel del Boletín Oficial** (1fr),
  separados por filete. El riel muestra normas en su fuente primaria — la
  estructura codifica algo cierto del portal, no decora.
- **Artículo:** una columna, medida ~72 caracteres (`max-w-3xl` + `prose-xl`),
  capitular en la segunda tinta, citas como pull quote sin barra lateral.
- **Blog y Agenda:** listas densas separadas por filetes. **Sin tarjetas, sin
  hover que levanta, sin zoom en imágenes.**
- **Agenda:** taco de calendario (día grande + mes/hora en mono). La
  **atribución del organizador va primero y en la segunda tinta**: la
  asociación agenda eventos de terceros, no los organiza.
- **Pie:** banda en tinta con el sello grande sobre disco de papel. Es la
  mitad oscura del logo y el remate de marca.

Utilidades: `.section-rule` (filete ámbar de 3 px sobre el que se apoya un
título) y `.label`.

---

## Anti-patrones

Los tres *looks por defecto* del diseño generado por IA, y dónde estamos:

| Default | Estado |
| --- | --- |
| Crema `#F4F1EA` + serif de alto contraste + terracota | **evitado** — egipcia, y el papel está a croma 4× |
| Fondo casi negro + acento ácido | no aplica |
| Maqueta de diario con filetes y radius cero | **presente, pero pedido explícitamente** (referencia The Verge) |

Además, nunca:

- Tarjetas redondeadas con sombra y hover que levanta.
- Gradientes decorativos que no vengan del atardecer del logo.
- Verde como color de marca (el logo no tiene verde).
- Emojis como iconos — SVG de Lucide.
- Imágenes de consumo, caras reconocibles o marcas (regla editorial, Art. 2°).

---

## Piso de calidad

- Contraste de texto ≥ 4,5:1 en ambos temas.
- Foco visible por teclado.
- `prefers-reduced-motion` respetado (bloque al final de `globals.css`).
- Responsive a 375 / 768 / 1024 / 1440.
- Verificar **los dos temas**: el duotono ya se rompió una vez solo en oscuro.

---

## Historia

La primera dirección fue **Organic Biophilic**: verde bosque `#15803D`, fondo
`#F0FDF4`, Newsreader + Roboto. Se descartó porque el cliente la encontró
genérica, y con razón: la paleta salió de un catálogo por tipo de producto en
vez del logo real —que no tiene una gota de verde— y el layout era un hero con
tarjetas que podía ser el de cualquier ONG.

Queda anotado para no volver a proponerla.
