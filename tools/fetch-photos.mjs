// Downloads place photos from Google (lh3.googleusercontent.com) into app/photos/.
// Usage: node tools/fetch-photos.mjs   (skips photos that already exist; --force re-downloads)
// Large: <id>.jpg (1600x1067, cropped 3:2), thumbnail: <id>_t.jpg (400x400). Needs Node 18+.
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sources = JSON.parse(await readFile(path.join(root, "tools/photo-sources.json"), "utf8"));
const force = process.argv.includes("--force");
const exists = p => access(p).then(() => true, () => false);

const jobs = [];
for (const [id, base] of Object.entries(sources)) {
  jobs.push([base + "=w1600-h1067-p-k-no", path.join(root, "app/photos", `${id}.jpg`)]);
  jobs.push([base + "=w400-h400-p-k-no", path.join(root, "app/photos", `${id}_t.jpg`)]);
}

let ok = 0, skipped = 0;
const failed = [];
async function worker() {
  while (jobs.length) {
    const [url, file] = jobs.shift();
    if (!force && await exists(file)) { skipped++; continue; }
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) throw new Error("too small: " + buf.length + " bytes");
      await writeFile(file, buf);
      ok++;
    } catch (err) {
      failed.push(`${path.basename(file)}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`downloaded ${ok}, already present ${skipped}, failed ${failed.length}`);
if (failed.length) {
  console.log("Failed (the app shows a category badge instead):\n  " + failed.join("\n  "));
  process.exitCode = 1;
}
