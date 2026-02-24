import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const socialDir = resolve(rootDir, "public", "social");

const targets = [
  {
    input: resolve(socialDir, "landing-preview.svg"),
    output: resolve(socialDir, "landing-preview.png"),
  },
  {
    input: resolve(socialDir, "dashboard-preview.svg"),
    output: resolve(socialDir, "dashboard-preview.png"),
  },
];

for (const target of targets) {
  const svg = readFileSync(target.input);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 1200,
    },
  });

  const png = resvg.render().asPng();
  writeFileSync(target.output, png);
  console.log(`generated ${target.output}`);
}
