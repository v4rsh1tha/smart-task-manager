import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In development, requests to /api go to the Express server.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:5000" } },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/setupTests.js" },
});
