import path from "node:path";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@applemusic-like-lyrics/core/style.css": path.resolve(
        __dirname,
        "../../core/src/styles/index.css",
      ),
      "@applemusic-like-lyrics/vue": path.resolve(__dirname, "../../vue/src"),
      "@applemusic-like-lyrics/core": path.resolve(__dirname, "../../core/src"),
      "@applemusic-like-lyrics/lyric": path.resolve(__dirname, "../../lyric/src"),
    },
  },
  plugins: [vue(), vueJsx()],
});
