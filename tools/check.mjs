// Validates app/data/places.json. Usage: node tools/check.mjs
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Data is stored encrypted (app/data/places.enc.json). Check the decrypted copy if it exists, else decrypt with BALI_PASSWORD.
let raw;
try { raw = await readFile(path.join(root, "app/data/places.json"), "utf8"); }
catch {
  if (!process.env.BALI_PASSWORD) { console.log("app/data/places.json нет — сначала: node tools/crypt.mjs decrypt (или задайте BALI_PASSWORD). Проверка пропущена."); process.exit(0); }
  const e = JSON.parse(await readFile(path.join(root, "app/data/places.enc.json"), "utf8"));
  const { subtle } = globalThis.crypto; const u = s => new Uint8Array(Buffer.from(s, "base64"));
  const base = await subtle.importKey("raw", new TextEncoder().encode(process.env.BALI_PASSWORD.trim().toUpperCase()), "PBKDF2", false, ["deriveKey"]);
  const k = await subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: u(e.salt), iterations: e.iter }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  raw = new TextDecoder().decode(await subtle.decrypt({ name: "AES-GCM", iv: u(e.iv) }, k, u(e.ct)));
}
const data = JSON.parse(raw);
const CATS = ["Водопад","Пляж","Природа","Смотровая","Культура","Кафе","Ресторан","Бар","Бич-клуб","Пул-клуб","Wellness","Активность","Мастер-класс","Шопинг","Проживание"];
const SRC = ["IG", "TG", "Web", "GM"];
const errors = [], warnings = [];
const ids = new Set(), names = new Map();
const exists = p => access(path.join(root, "app", p)).then(() => true, () => false);

for (const p of data.places) {
  const tag = `#${p.id} ${p.name}`;
  if (!Number.isInteger(p.id)) errors.push(`${tag}: id must be an integer`);
  if (ids.has(p.id)) errors.push(`${tag}: duplicate id`);
  ids.add(p.id);
  const key = p.name.toLowerCase().replace(/[^a-zа-я0-9]/g, "");
  if (names.has(key)) warnings.push(`${tag}: same name as #${names.get(key)} — possible duplicate`);
  names.set(key, p.id);
  for (const f of ["name", "region", "cat", "desc", "area", "gm", "src"]) if (!p[f]) errors.push(`${tag}: empty "${f}"`);
  if (data.districts && !data.districts.some(d => d.name === p.region)) errors.push(`${tag}: region "${p.region}" is not in districts[]`);
  if (!CATS.includes(p.cat)) errors.push(`${tag}: unknown category "${p.cat}"`);
  if (!(p.lat > -8.95 && p.lat < -8.0 && p.lng > 114.4 && p.lng < 115.75)) errors.push(`${tag}: coordinates outside Bali (${p.lat}, ${p.lng})`);
  for (const s of p.src.split("+").map(s => s.trim())) if (!SRC.includes(s)) errors.push(`${tag}: unknown source "${s}"`);
  if (p.level !== null && p.level !== undefined && ![0, 1, 2, 3, 4].includes(p.level)) errors.push(`${tag}: price level must be 0–4 or null`);
  if (p.img && !(await exists(p.img))) warnings.push(`${tag}: photo missing (${p.img}) — run "npm run photos"`);
}
console.log(`${data.places.length} places, ${errors.length} errors, ${warnings.length} warnings`);
warnings.forEach(w => console.log("warn  " + w));
errors.forEach(e => console.log("ERROR " + e));
if (errors.length) process.exitCode = 1;
