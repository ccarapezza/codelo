import { factories } from "@strapi/strapi";

// Público: el buscador de la web lo consume sin token.
export default factories.createCoreRouter("api::cultivar.cultivar", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
