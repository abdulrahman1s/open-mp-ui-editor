import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL(".", import.meta.url)));
await build({
  entryPoints: ["frontend/workspace.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: "dist/workspace.js",
  legalComments: "eof",
  define: { "process.env.NODE_ENV": '"production"' },
});
execFileSync(
  process.execPath,
  [
    "node_modules/@tailwindcss/cli/dist/index.mjs",
    "-i",
    "frontend/styles.css",
    "-o",
    "dist/workspace.css",
    "--minify",
  ],
  { stdio: "inherit" },
);
