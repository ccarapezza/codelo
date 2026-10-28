# Salida argentina para el Boletín Oficial

`boletinoficial.gob.ar` sólo acepta conexiones desde IPs argentinas (desde el
22-oct-2026) y el VPS está en EE.UU. Para que el CMS lo pueda consultar, las PCs
de la casa le prestan su conexión: cada una abre un túnel SSH **hacia** el VPS y
OpenSSH hace de proxy SOCKS, restringido al Boletín.

```
codelo-cms ──SOCKS──▶ 172.17.0.1:18881 (VPS) ══túnel SSH══▶ PC 1 ──▶ www.boletinoficial.gob.ar:443
           └─(si no)─▶ 172.17.0.1:18882 (VPS) ══túnel SSH══▶ PC 2 ──▶        ⋯
```

- **Cualquiera de las dos sirve.** El CMS prueba los proxies de
  `BOLETIN_PROXY_URL` en orden y se queda con el que responda. Con las dos
  apagadas, el widget del panel lo avisa.
- **No se abre nada en el router.** La conexión la inicia la PC, hacia afuera.
  Si cambia la IP de la casa, el túnel se corta, la PC lo detecta en ~45 s y lo
  vuelve a abrir sola.
- **Arranca con la PC**, sin iniciar sesión (servicio de systemd), y se
  reconecta después de suspender o cambiar de red.
- **El VPS no ve la casa.** La PC sólo deja salir por el túnel hacia
  `www.boletinoficial.gob.ar:443` (`PermitRemoteOpen`): ni la red local, ni otro
  sitio, ni otro puerto. El TLS va de punta a punta: la PC tampoco ve el
  contenido.
- **El usuario del túnel en el VPS no puede hacer nada más.** Sin shell, sin
  contraseña, sólo `-R` y sólo a su puerto. Cada PC tiene su propia clave y se
  revoca por separado.

## Instalar

1. **En el VPS, una sola vez:**

   ```sh
   cd /opt/codelo && sudo deploy/boletin-tunnel/setup-vps.sh preparar
   ```

2. **En cada PC** (Debian, desde un clon del repo):

   ```sh
   sudo deploy/boletin-tunnel/install-pc.sh 18881   # en una
   sudo deploy/boletin-tunnel/install-pc.sh 18882   # en la otra
   ```

   Al final imprime el comando para autorizarla.

3. **En el VPS, por cada PC**, el comando que imprimió el paso 2:

   ```sh
   sudo deploy/boletin-tunnel/setup-vps.sh autorizar 18881 "ssh-ed25519 AAAA… boletin-tunnel@pc"
   ```

4. `BOLETIN_PROXY_URL` ya está en el `Jenkinsfile`; el fragmento (`#nitro-v15`)
   es el nombre que muestra el panel en "salió por …".

## Verificar

```sh
# En una PC
systemctl status boletin-tunnel
journalctl -u boletin-tunnel -f

# En el VPS: qué túneles están arriba, y una consulta real por cada uno
ss -ltn | grep -E '172.17.0.1:1888[12]'
curl -s -o /dev/null -w '%{http_code}\n' --socks5-hostname 172.17.0.1:18881 https://www.boletinoficial.gob.ar/
```

Y en el panel, el widget del Boletín: "Última consulta … · salió por …".

## Problemas

| Síntoma en `journalctl -u boletin-tunnel` | Qué es |
| --- | --- |
| `Permission denied (publickey)` | Falta autorizar la clave (paso 3) o se autorizó con otro puerto. |
| `remote port forwarding failed for listen port` | El VPS todavía tiene tomada la sesión anterior (corte brusco). Se libera sola en ≤45 s y el servicio reintenta. |
| `Host key verification failed` | Cambió la clave del VPS (¿se reinstaló?). Actualizar `known_hosts` en el repo y reinstalar. |
| Nada, pero el panel dice que no respondió ningún proxy | Mirar `ss -ltn` en el VPS. Si los puertos están, revisar la regla de `ufw` (`ufw status \| grep boletin`). |

## Sacar una PC

```sh
sudo systemctl disable --now boletin-tunnel        # en la PC
sudo deploy/boletin-tunnel/setup-vps.sh revocar 18882   # en el VPS
```
