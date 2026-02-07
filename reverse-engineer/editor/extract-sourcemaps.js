import fs from "fs";
import path from "path";

const mapsDir = "./assets";
const outDir = "./recovered-src";

fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(mapsDir)) {
  if (!file.endsWith(".map")) continue;

  const mapPath = path.join(mapsDir, file);
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));

  if (!map.sources || !map.sourcesContent) continue;

  map.sources.forEach((src, i) => {
    const content = map.sourcesContent[i];
    if (!content) return;

    const cleanPath = src.replace(/^(\.\.\/)+/, "");
    const target = path.join(outDir, cleanPath);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  });
}

console.log("✅ Source extraction complete");
