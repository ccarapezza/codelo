import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::post.post", {
	config: {
		find: { auth: false },
		findOne: { auth: false },
	},
});
