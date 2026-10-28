#!/usr/bin/env bash
# Prepara el VPS para recibir los túneles de las PCs de la casa, y las autoriza.
# Idempotente. En el VPS, desde /opt/codelo:
#
#   sudo deploy/boletin-tunnel/setup-vps.sh preparar
#   sudo deploy/boletin-tunnel/setup-vps.sh autorizar 18881 "ssh-ed25519 AAAA… boletin-tunnel@pc"
#   sudo deploy/boletin-tunnel/setup-vps.sh revocar 18881
#
# `preparar` toca tres cosas del server, y nada más:
#   1. crea el usuario boletin-tunnel (sin shell ni contraseña);
#   2. agrega /etc/ssh/sshd_config.d/50-boletin-tunnel.conf, y ANTES de
#      recargar sshd comprueba que la config efectiva de los demás usuarios no
#      cambió en una sola línea; si cambió, lo deshace;
#   3. abre en ufw los puertos de los túneles SÓLO desde las redes de Docker
#      hacia 172.17.0.1 (docker0). Desde internet siguen cerrados.
set -euo pipefail

USUARIO=boletin-tunnel
CASA=/var/lib/$USUARIO
DROPIN=/etc/ssh/sshd_config.d/50-boletin-tunnel.conf
DIR=$(cd "$(dirname "$0")" && pwd)
# Contexto ficticio para `sshd -T`: una IP de documentación, no matchea nada real.
CTX="host=example.invalid,addr=203.0.113.10"

[ "$(id -u)" = 0 ] || { echo "Correr con sudo." >&2; exit 1; }

puerto_valido() {
  case "${1:-}" in 18881 | 18882) ;; *) echo "Puerto inválido: '${1:-}' (18881 o 18882)" >&2; exit 1 ;; esac
}

preparar() {
  ip -4 addr show docker0 | grep -q ' 172\.17\.0\.1/' ||
    { echo "docker0 no es 172.17.0.1: revisar antes de seguir." >&2; exit 1; }

  # 1. Usuario
  id "$USUARIO" >/dev/null 2>&1 ||
    useradd --system --home-dir "$CASA" --create-home --shell /usr/sbin/nologin "$USUARIO"
  install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$CASA/.ssh"
  touch "$CASA/.ssh/authorized_keys"
  chown "$USUARIO:$USUARIO" "$CASA/.ssh/authorized_keys"
  chmod 600 "$CASA/.ssh/authorized_keys"

  # 2. sshd, con red: se compara la config efectiva de los usuarios reales.
  local otros u antes despues tunel
  otros=$(printf '%s\n' root deploy "${SUDO_USER:-}" | grep -v '^$' | sort -u)
  antes=$(for u in $otros; do sshd -T -C "user=$u,$CTX"; done)
  install -m 644 "$DIR/sshd-boletin-tunnel.conf" "$DROPIN"
  deshacer() { rm -f "$DROPIN"; echo "ABORTADO: $1. Se quitó $DROPIN; sshd no se recargó." >&2; exit 1; }
  sshd -t || deshacer "sshd -t rechazó la configuración"
  despues=$(for u in $otros; do sshd -T -C "user=$u,$CTX"; done)
  [ "$antes" = "$despues" ] || deshacer "cambiaba la configuración efectiva de: $(echo $otros)"
  tunel=$(sshd -T -C "user=$USUARIO,$CTX")
  for esperado in "gatewayports clientspecified" "allowtcpforwarding remote" "passwordauthentication no" "permittty no"; do
    grep -qx "$esperado" <<<"$tunel" || deshacer "al usuario $USUARIO no le aplica '$esperado'"
  done
  systemctl reload ssh
  echo "sshd: OK (los demás usuarios quedan exactamente igual)."

  # 3. ufw: de los containers a los túneles; de afuera, nada.
  if ! ufw status | grep -q "$USUARIO"; then
    ufw allow proto tcp from 172.16.0.0/12 to 172.17.0.1 port 18881:18882 comment "$USUARIO" >/dev/null
  fi
  echo "ufw: OK (18881-18882 sólo desde redes Docker hacia 172.17.0.1)."
}

autorizar() {
  local puerto=${1:-} clave=${2:-}
  puerto_valido "$puerto"
  [[ "$clave" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] ||
    { echo "Eso no parece una clave pública ssh-ed25519." >&2; exit 1; }
  ssh-keygen -l -f <(echo "$clave") >/dev/null || { echo "Clave inválida." >&2; exit 1; }
  local ak="$CASA/.ssh/authorized_keys"
  [ -f "$ak" ] || { echo "Falta '$0 preparar'." >&2; exit 1; }
  # Una clave por puerto: autorizar de nuevo un puerto reemplaza a la anterior.
  # restrict apaga todo (shell, pty, agente…); port-forwarding devuelve sólo
  # los túneles, y permitlisten ata la clave a SU puerto.
  local resto
  resto=$(grep -v "permitlisten=\"172.17.0.1:$puerto\"" "$ak" || true)
  {
    [ -n "$resto" ] && printf '%s\n' "$resto"
    printf 'restrict,port-forwarding,permitlisten="172.17.0.1:%s" %s\n' "$puerto" "$clave"
  } >"$ak.nuevo"
  install -m 600 -o "$USUARIO" -g "$USUARIO" "$ak.nuevo" "$ak"
  rm -f "$ak.nuevo"
  echo "Autorizada para el puerto $puerto: $(ssh-keygen -l -f <(echo "$clave"))"
}

revocar() {
  local puerto=${1:-}
  puerto_valido "$puerto"
  local ak="$CASA/.ssh/authorized_keys"
  grep -v "permitlisten=\"172.17.0.1:$puerto\"" "$ak" >"$ak.nuevo" || true
  install -m 600 -o "$USUARIO" -g "$USUARIO" "$ak.nuevo" "$ak"
  rm -f "$ak.nuevo"
  # Revocar la clave no cierra lo ya abierto: se cortan las sesiones vivas del
  # usuario. La otra PC, si su clave sigue autorizada, se reconecta en ~15 s.
  pkill -u "$USUARIO" -f "sshd" 2>/dev/null || true
  echo "Revocada la clave del puerto $puerto."
}

case "${1:-}" in
  preparar) preparar ;;
  autorizar) autorizar "${2:-}" "${3:-}" ;;
  revocar) revocar "${2:-}" ;;
  *) echo "Uso: sudo $0 preparar | autorizar <puerto> \"<clave>\" | revocar <puerto>" >&2; exit 1 ;;
esac
