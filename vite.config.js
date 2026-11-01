import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

function beaconTag(token) {
  if (!token) return "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) {
    throw new Error("VITE_CF_BEACON_TOKEN is set, but it is not a safe token string.");
  }
  return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`;
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const token = process.env.VITE_CF_BEACON_TOKEN || fileEnv.VITE_CF_BEACON_TOKEN || "";
  return {
    base: "/",
    plugins: [
      vue(),
      {
        name: "cf-beacon",
        transformIndexHtml(html) {
          const tag = beaconTag(token);
          if (!tag) return html.replace(/\s*<!-- CF_BEACON -->/, "");
          return html.replace("<!-- CF_BEACON -->", tag);
        },
      },
    ],
    build: {
      outDir: "dist",
      assetsDir: "static",
      cssCodeSplit: false,
    },
    ssgOptions: {
      script: "defer",
      formatting: "minify",
      dirStyle: "flat",
      beastiesOptions: false,
      includedRoutes() {
        return [
          "/",
          "/about",
          "/projects",
          "/skills",
          "/resume",
          "/resume/skills",
          "/resume/experience",
          "/resume/education",
          "/resume/clubs",
          "/resume/awards",
          "/diners",
        ];
      },
    },
  };
});
