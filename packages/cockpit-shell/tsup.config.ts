import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Bundle client components (shell + chat + primitives)
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    external: ["react", "react-dom", "next", "openai", "dompurify", "zod"],
    outDir: "dist",
    banner: { js: '"use client";' },
  },
  {
    // Bundle server handler — PAS de "use client"
    entry: { "handler/createCockpitChatHandler": "src/handler/createCockpitChatHandler.ts" },
    format: ["esm"],
    dts: true,
    external: ["react", "react-dom", "next", "openai", "dompurify", "zod"],
    outDir: "dist",
  },
]);
