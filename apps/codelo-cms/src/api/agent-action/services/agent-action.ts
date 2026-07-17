import { factories } from "@strapi/strapi";

// Generated types for new content-types aren't available until the next
// `strapi build` regenerates `types/generated/contentTypes.d.ts`. Until
// then we widen via `as never` so tsc doesn't fail the typecheck.
export default factories.createCoreService("api::agent-action.agent-action" as never);
