# Levantar una instancia nueva

Nib es el motor; una instancia es el motor apuntado a un tema. Esta guía es el
camino completo, y **no requiere escribir código**: todo lo editorial vive en la
base y se configura desde el panel.

Escribir código sólo hace falta para lo que ES código — un lector de un registro
público, un tipo de agente propio, una pantalla nueva. Eso va en las costuras,
que están en [`adoptar-nib.md`](./adoptar-nib.md).

## 0. Lo que vas a tener

Un CMS con agentes que leen fuentes RSS, escriben notas, las revisan antes de
publicar y arman las placas para redes; y un sitio Next.js que las muestra. Con
la configuración por defecto funciona, pero escribe como un portal de noticias
genérico llamado Nib: el paso 4 es el que lo convierte en TU sitio.

## 1. Entorno

Copiá `deploy/templates/docker-compose.prod.yml` y `deploy/templates/Jenkinsfile`
a la raíz de tu repo y completá los `<slug>`. Las variables que no son obvias:

| Variable | Para qué |
| --- | --- |
| `PROJECT_SLUG` | Identifica la instalación: prefija las claves internas y los contenedores. **En producción no tiene default**, y sin ella la siembra y la migración de i18n se saltean por seguridad. |
| `PROJECT_NAME` | El nombre de la instalación. Distinto de la marca editorial, que se edita en el panel. |
| `SITE_PUBLIC_URL` | La URL del **sitio**, no la del CMS. De acá salen el dominio que imprimen las placas y el User-Agent con el que se piden los feeds. |
| `OPENAI_API_KEY` | Sin esto no se genera nada. |
| `OPENAI_ADMIN_KEY` | Opcional, sólo para ver consumo y costo en el panel. Es una clave de **organización** (`sk-admin-…`), distinta de la anterior: se crea en Settings → Organization → Admin keys. Sin ella todo funciona igual y la tarjeta de uso lo dice. |
| `OPENROUTER_API_KEY` | Sólo si vas a usar modelos de imagen o video de OpenRouter. |
| `DEFAULT_LOCALE` / `TRANSLATION_LOCALE` | Códigos de locale (`es`, `en`, `pt-BR`). Van por env y no por panel porque Strapi los usa para crear localizaciones: cambiarlos con contenido cargado exige una migración, no un click. |
| `AGENT_SCHEDULE_TZ` | Zona horaria de los schedules y los crons. |

Para probar en tu máquina: `./scripts/local-up.sh` levanta todo y te dice la URL
del panel.

## 2. Primer administrador

Entrá a `/admin` y creá el primer usuario. Es el único paso que no se puede
automatizar.

El panel está en **castellano e inglés**: el selector está arriba a la derecha
en el login, y también en tu perfil. El idioma se guarda por persona, así que
cada quien elige el suyo.

## 3. El checklist es el mapa

La home del panel tiene **Puesta en marcha**: lista sólo lo que falta, marca qué
bloquea la publicación y qué es calidad, y cada ítem enlaza a donde se resuelve.
Si tenés dudas sobre qué hacer después, esa lista es la respuesta.

Los cuatro pasos que siguen son, justamente, lo que el checklist va tachando.

## 4. Configuración editorial

`/admin/prompt-settings`. Es el paso que convierte el motor en tu portal: lo que
escribas acá lo leen los agentes en cada corrida. Las tarjetas están numeradas en
el orden en que conviene completarlas.

**Un campo vacío usa el valor por defecto del motor**, y «Restaurar» vuelve a ese
valor neutro — no al texto con el que arrancó tu proyecto. Es a propósito:
restaurar es volver al motor.

Algunos campos van **en inglés** aunque el sitio escriba en castellano, y están
marcados: se insertan dentro de prompts en inglés, y mezclar idiomas ahí degrada
la respuesta.

1. **Identidad** — el nombre con el que firman los agentes y, sobre todo, *de qué
   habla el sitio*. Ese campo lo leen el redactor, el Director, el deduplicador y
   el traductor: si dice de más o de menos, los cuatro se desvían igual.
2. **Línea editorial** — qué datos no se pueden inventar nunca, cómo se encuadra
   una nota sin fuentes verificadas, la voz y el formato del cuerpo, y qué fuentes
   oficiales se pueden citar por nombre sin que cuente como copiar a un medio.
3. **Portadas** — qué se ve en las imágenes. ⚠️ En *Anclas a extraer*, cada línea
   `- clave: regla` **declara una clave** que se le pide al modelo: agregar o
   quitar una línea cambia lo que se extrae.
4. **Redes y video** — la voz de las placas, los hashtags, el estilo de los clips.
5. **Traducción** — sólo se usa si la activás en el paso 5.

## 5. Sitio e integraciones

`/admin/site-settings`. Los modelos de texto e imagen (con sus precios a la
vista), si se traduce automáticamente cada nota —en un sitio monolingüe conviene
apagarlo, es una llamada al modelo por nota que no se usa—, y AdSense, Analytics
y Clarity si corresponden.

### Identidad visual

En esa misma pantalla están **los colores y el logo de las placas de redes**.
Es el paso que evita que tus carruseles salgan con el verde azulado de Nib.

Los colores se nombran por el papel que cumplen, no por el tono, y el orden en
que están es el de la placa: fondo, los tres niveles de texto (titular, cuerpo,
pie) y los tres acentos.

- **Acento claro** es el que lleva TODO acento que sea texto: los números
  grandes, la comilla de las citas, la url del cierre.
- **Acento profundo** cierra el degradé y tiñe los velos. Nunca lleva texto
  encima, así que puede ser bien oscuro.

**Mirá la vista previa mientras elegís.** El error nunca está en un color suelto
sino en la combinación, y la placa de ejemplo es donde se ve. Si un texto queda
por debajo del contraste mínimo aparece un aviso con el número.

El logo se sube ahí mismo. **El logo por defecto está dibujado para fondo
oscuro**: si tu fondo es claro, subí el tuyo o la firma al pie no se va a ver.
Un campo de color vacío usa el del motor, igual que en la configuración
editorial.

## 6. Agentes

`/admin/ai-agents`. Necesitás como mínimo **un redactor y un Director**. Sin
Director los borradores se acumulan sin que nadie los publique.

- El `topic` de un redactor es una **bolsa de palabras clave**, no una frase: así
  se cruza con los títulos de las noticias.
- `requireNewsContext` activado hace que el redactor NO escriba si no hay
  noticias que matcheen su tema. Sin eso, escribe de memoria del modelo e
  inventa.
- El generador de portadas es opcional: sin él las notas salen sin imagen.

## 7. Fuentes y etiquetas

`/admin/rss-feeds` → **Buscar fuentes** encuentra feeds por tema y los verifica
antes de ofrecértelos: lo que aparece en la lista existe, parsea y tiene notas.
Mirá el porcentaje de «habla del tema» antes de agregar uno: un medio generalista
publica mucho y casi nada de lo tuyo, y por volumen te llena el pool.

Las etiquetas se cargan desde el Content Manager.

## 8. Primera corrida

En un redactor, **Correr ahora**. Después en el Director. Mirá **Auditoría**: ahí
está por qué se publicó o se rechazó cada nota, con las fuentes citadas. Si algo
no salió como esperabas, ese texto te dice qué campo de la configuración ajustar.

Cuando el checklist queda en verde, los schedules se encargan solos.

## 9. Opcional: congelar la configuración como semilla

Si vas a levantar la misma instancia más de una vez, o querés la configuración
versionada, escribí los valores en `src/verticals/seed.ts`. El motor la aplica
una vez en el arranque y **rellena sólo lo que está vacío**: lo que ya editaste
desde el panel siempre gana.

Después de la primera corrida la fuente de verdad es la base. Editar el archivo
no cambia nada de lo ya cargado; eso se hace desde el panel.
