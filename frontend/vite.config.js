import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import fs from "fs"
import path from "path"
import { pathToFileURL, fileURLToPath } from "url"
import { defineConfig } from 'vite'

function loadLocalEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function liveAiDev() {
  return {
    name: "raviqen-live-ai",
    configureServer(server) {
      const root = path.resolve(frontendRoot, "..");
      loadLocalEnv(path.join(root, ".env.local"));
      loadLocalEnv(path.join(root, "backend", ".env"));
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/ai") && !url.startsWith("/api/market")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }
        try {
          const body = await readJson(req);
          const core = await import(pathToFileURL(path.join(root, "api", "aiCore.mjs")).href);
          const result = url.startsWith("/api/market")
            ? { items: await core.runMarket(body) }
            : { result: await core.runChat({ prompt: body.prompt, schema: body.schema }) };
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = error.status || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "AI request failed.", items: [] }));
        }
      });
    },
  };
}

const frontendRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: frontendRoot,
  resolve: {
    alias: { "@": path.resolve(frontendRoot, "src") },
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    liveAiDev(),
  ]
});
