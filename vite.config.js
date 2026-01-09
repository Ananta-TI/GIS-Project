import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        map: resolve(__dirname, "map.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        // news: resolve(__dirname, "news.html"),
      },
    },
  },
});
