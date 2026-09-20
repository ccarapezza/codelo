// Uso/créditos de las APIs de IA — admin-only (requireAdmin dentro del
// controller, mismo patrón que social-studio / post admin).
export default {
  routes: [
    {
      method: "GET",
      path: "/usage/ai",
      handler: "api::usage.usage.ai",
      config: { auth: false },
    },
  ],
};
