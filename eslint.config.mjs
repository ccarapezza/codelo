import next from "eslint-config-next";

export default [
  ...next(),
  {
    ignores: ["apps/codelo-cms/.strapi/**", "apps/codelo-cms/build/**", "apps/codelo-cms/.tmp/**"],
  },
];
