// "Deploy" (el ícono de nube) lo agregaba @strapi/plugin-cloud. Este proyecto
// se despliega en VPS propio con Jenkins + Caddy, así que el ítem no llevaba a
// ningún lado y se DESINSTALÓ la dependencia.
//
// Ojo: `{ "strapi-cloud": { enabled: false } }` acá NO alcanza. Apaga el plugin
// del lado del server, pero el entrypoint del admin (.strapi/client/app.js) se
// genera escaneando las dependencias del package.json, así que el import y el
// ítem del menú vuelven en cada rebuild. Sacarlo del menú exige quitar el
// paquete.
export default () => ({});
