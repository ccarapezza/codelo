// Manual triggers for the INASE mirrors.
//
// The crons (weekly for cultivares, every 2 days for operadores) are the normal
// path; these exist to seed a fresh environment and to re-run after a failure
// without waiting days. Auth is the same shared-secret header the other
// internal endpoints use — checked inside the controller.
export default {
  routes: [
    {
      method: "POST",
      path: "/inase/sync-cultivares",
      handler: "api::cultivar.cultivar.syncFromInase",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/inase/sync-operadores",
      handler: "api::cultivar.cultivar.syncOperadoresFromInase",
      config: { auth: false },
    },
  ],
};
