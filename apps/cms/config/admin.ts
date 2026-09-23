export default ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
    sessions: {
      accessTokenLifespan: env.int("ADMIN_ACCESS_TOKEN_LIFESPAN", 30 * 60),
      idleRefreshTokenLifespan: env.int("ADMIN_IDLE_REFRESH_TOKEN_LIFESPAN", 7 * 24 * 60 * 60),
      idleSessionLifespan: env.int("ADMIN_IDLE_SESSION_LIFESPAN", 60 * 60),
      maxRefreshTokenLifespan: env.int("ADMIN_MAX_REFRESH_TOKEN_LIFESPAN", 30 * 24 * 60 * 60),
      maxSessionLifespan: env.int("ADMIN_MAX_SESSION_LIFESPAN", 30 * 24 * 60 * 60),
    },
  },
  apiToken: {
    salt: env("API_TOKEN_SALT"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT"),
    },
  },
  secrets: {
    encryptionKey: env("ENCRYPTION_KEY"),
  },
  // Ruido de Strapi apagado por defecto. Que el panel no lo esconda —el login
  // dice sobre qué corre y la pantalla de versión queda intacta— no significa
  // que tenga que pedirle cosas al usuario en nombre de Strapi:
  //
  //   · nps — la encuesta "¿qué tan probable es que recomiendes Strapi a un
  //     amigo?". Quien entra acá no eligió Strapi ni sabe necesariamente qué es:
  //     la pregunta no tiene sentido para él y su respuesta no le sirve a nadie.
  //     (La lee NpsSurvey.mjs como `window.strapi.flags.nps === false`.)
  //   · promoteEE — la promoción de la edición Enterprise.
  //
  // Se pueden volver a encender por env, que es lo que las deja como decisión de
  // la instalación y no del motor.
  flags: {
    nps: env.bool("FLAG_NPS", false),
    promoteEE: env.bool("FLAG_PROMOTE_EE", false),
  },
});
