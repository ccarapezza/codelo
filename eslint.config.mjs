import next from "eslint-config-next";

export default [
  ...next(),
  {
    ignores: ["apps/cms/.strapi/**", "apps/cms/build/**", "apps/cms/.tmp/**"],
  },
];
