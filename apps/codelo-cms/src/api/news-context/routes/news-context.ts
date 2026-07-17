import { factories } from "@strapi/strapi";
export default factories.createCoreRouter("api::news-context.news-context", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
