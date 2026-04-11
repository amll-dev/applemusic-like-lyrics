import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@applemusic-like-lyrics/core/style.css": path.resolve(
        __dirname,
        "../../core/src/styles/index.css",
      ),
      "@applemusic-like-lyrics/react": path.resolve(__dirname, "../../react/src"),
      "@applemusic-like-lyrics/core": path.resolve(__dirname, "../../core/src"),
      "@applemusic-like-lyrics/lyric": path.resolve(__dirname, "../../lyric/src"),
    },
  },
  plugins: [react()],
});
