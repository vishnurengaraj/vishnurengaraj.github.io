import { ViteSSG } from "vite-ssg";
import App from "./App.vue";
import { routes } from "./router.js";
import "./styles/base.css";
import "./styles/title.css";
import "./styles/content.css";

const HASH_TO_PATH = {
  about: "/about",
  projects: "/projects",
  resume: "/resume",
  top: "/",
};

export const createApp = ViteSSG(App, { routes, base: import.meta.env.BASE_URL }, ({ router }) => {
  router.beforeEach((to) => {
    if (to.hash) {
      const id = to.hash.replace(/^#/, "");
      return { path: HASH_TO_PATH[id] || to.path, hash: "", query: to.query, replace: true };
    }
    if (to.path.length > 1 && to.path.endsWith("/")) {
      return { path: to.path.replace(/\/+$/, "") || "/", query: to.query, replace: true };
    }
  });
});
