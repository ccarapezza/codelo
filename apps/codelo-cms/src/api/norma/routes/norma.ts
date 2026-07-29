import { factories } from "@strapi/strapi";

// Público: el riel de la home y la página /normativa lo consumen sin token.
export default factories.createCoreRouter("api::norma.norma", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
