#!/usr/bin/env bash
# Instala en una PC de la casa (Debian) el túnel que le da al CMS una salida
# argentina hacia el Boletín Oficial. Arranca solo con la PC, sin que nadie
# inicie sesión, y se reconecta solo. Idempotente: correrlo de nuevo actualiza
# la unidad y el puerto sin tocar la clave.
#
#   sudo deploy/boletin-tunnel/install-pc.sh 18881    # en una PC
#   sudo deploy/boletin-tunnel/install-pc.sh 18882    # en la otra
#
# Al final imprime la clave pública de la PC: hay que autorizarla en el VPS
# (ver README.md). Hasta entonces el servicio reintenta cada 15 s.
set -euo pipefail

PUERTO=${1:-}
case "$PUERTO" in
  1888[1-9]) ;;
  *) echo "Uso: sudo $0 <puerto>   (18881 en una PC, 18882 en la otra)" >&2; exit 1 ;;
esac
[ "$(id -u)" = 0 ] || { echo "Correr con sudo." >&2; exit 1; }
command -v ssh >/dev/null || apt-get install -y openssh-client

DIR=$(cd "$(dirname "$0")" && pwd)
USUARIO=boletin-tunnel
CASA=/var/lib/$USUARIO
VPS=194.140.199.13

# Un usuario de sistema, sin shell: el túnel no corre con tu usuario ni con root.
id "$USUARIO" >/dev/null 2>&1 ||
  useradd --system --home-dir "$CASA" --create-home --shell /usr/sbin/nologin "$USUARIO"
install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$CASA"

# Una clave por PC: si se pierde o se vende una, se revoca sólo esa.
[ -f "$CASA/id_ed25519" ] ||
  runuser -u "$USUARIO" -- ssh-keygen -q -t ed25519 -N "" -C "$USUARIO@$(hostname)" -f "$CASA/id_ed25519"

# La clave del VPS va fijada: la PC no le habla a nada que se haga pasar por él.
install -d -m 755 /etc/$USUARIO
install -m 644 "$DIR/known_hosts" /etc/$USUARIO/known_hosts
printf 'TUNNEL_PORT=%s\nVPS=%s\n' "$PUERTO" "$VPS" > /etc/$USUARIO/env

install -m 644 "$DIR/boletin-tunnel.service" /etc/systemd/system/boletin-tunnel.service
systemctl daemon-reload
systemctl enable boletin-tunnel.service >/dev/null
systemctl restart boletin-tunnel.service

echo
echo "Listo: el túnel arranca solo con la PC (puerto $PUERTO en el VPS)."
echo "Estado:  systemctl status boletin-tunnel    Logs:  journalctl -u boletin-tunnel -f"
echo
echo "Clave pública de esta PC — autorizarla en el VPS con:"
echo "  sudo deploy/boletin-tunnel/setup-vps.sh autorizar $PUERTO \"$(cat "$CASA/id_ed25519.pub")\""
