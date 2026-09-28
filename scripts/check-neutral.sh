#!/usr/bin/env bash
# El motor no nombra un tema, una marca ni un dominio.
#
# Es la regla del CLAUDE.md, ejecutable. Corre en CI: un ejemplo de un vertical
# que se cuela en una pantalla del motor se lo lleva TODA instancia, y así
# terminó un portal de fútbol publicando placas con #cannabis.
#
# La única excepción es apps/cms/test/preservation/, donde el texto real está
# congelado a propósito para demostrar que el refactor no cambia comportamiento.
#
# Los scripts, el README y el Dockerfile entran al scan porque viajan con el
# motor igual que el código: un README que decía "# fulbo-cms" y un script de
# prueba que pedía "a football stadium at golden hour" le llegaban a toda
# instancia nueva. Y los términos van también en inglés: los prompts están
# escritos en inglés y ahí es donde más se esconde un resto.
set -euo pipefail

# Lo propio de un proyecto que vive fuera de las costuras con nombre —sus
# content-types, sus scripts, una home propia— va en scripts/check-neutral.ignore:
# un patrón de `grep -E` por línea, contra la salida `archivo:línea:texto`. En
# Nib no existe. Existe para que ESTE archivo sea idéntico en el motor y en cada
# proyecto: si cada uno lo editara para excluir lo suyo, el merge conflictuaría.
IGNORAR=scripts/check-neutral.ignore
filtrar_proyecto() {
  if [[ -f "$IGNORAR" ]]; then
    grep -vEf <(grep -vE '^[[:space:]]*(#|$)' "$IGNORAR") || true
  else
    cat
  fi
}

TERMINOS='cannabis|cáñamo|canamo|cannábic|reprocann|ariccame|inase|boletín oficial'
TERMINOS+='|futbol|fútbol|jugador|arquero|conmebol|cogollos|codelo|fulbo'
TERMINOS+='|football|soccer|stadium|jersey|fifa|world cup'

hits=$(grep -rniE "$TERMINOS" \
  apps/cms/src apps/cms/config apps/cms/scripts apps/cms/README.md apps/cms/Dockerfile \
  apps/web/app apps/web/components apps/web/lib \
  deploy scripts .env.example 2>/dev/null \
  | grep -vE 'apps/cms/src/verticals/|apps/cms/src/admin/verticals|apps/web/(app/\[lang\]/\(vertical\)|components/vertical|lib/vertical|lib/site\.ts)' \
  | grep -v '^scripts/check-neutral\.sh:' \
  | filtrar_proyecto \
  || true)

if [[ -n "$hits" ]]; then
  echo "✗ El motor nombra un tema o una marca:"
  echo "$hits"
  echo
  echo "Lo específico de un proyecto va en las costuras (src/verticals/, admin/verticals.ts)"
  echo "o en la configuración editorial, que vive en la base y se edita desde el panel."
  exit 1
fi
echo "✓ el motor no nombra ningún tema"
