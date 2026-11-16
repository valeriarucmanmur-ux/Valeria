// Шифрует/расшифровывает данные приложения паролем (AES-256-GCM, ключ из пароля через PBKDF2-SHA256).
//   node tools/crypt.mjs encrypt   app/data/places.json      -> app/data/places.enc.json (это и публикуется)
//   node tools/crypt.mjs decrypt   app/data/places.enc.json  -> app/data/places.json      (только для правки, в git не попадает)
// Пароль: переменная окружения BALI_PASSWORD или ввод с клавиатуры. Регистр букв и пробелы по краям не важны.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline/promises";
const { subtle } = globalThis.crypto;
const getRandomValues = a => globalThis.crypto.getRandomValues(a);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLAIN = path.join(root, "app/data/places.json"), ENC = path.join(root, "app/data/places.enc.json");
const ITER = 250000;
const b64 = u => Buffer.from(u).toString("base64"), unb64 = s => new Uint8Array(Buffer.from(s, "base64"));
const norm = p => p.trim().toUpperCase();
async function key(pass, salt, iter) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(norm(pass)), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function password() {
  if (process.env.BALI_PASSWORD) return process.env.BALI_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const p = await rl.question("Пароль: "); rl.close(); return p;
}
const mode = process.argv[2];
if (mode === "encrypt") {
  const json = JSON.stringify(JSON.parse(await readFile(PLAIN, "utf8")));
  const salt = getRandomValues(new Uint8Array(16)), iv = getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, await key(await password(), salt, ITER), new TextEncoder().encode(json));
  await writeFile(ENC, JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
  console.log("зашифровано →", path.relative(root, ENC));
} else if (mode === "decrypt") {
  const e = JSON.parse(await readFile(ENC, "utf8"));
  try {
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv) }, await key(await password(), unb64(e.salt), e.iter), unb64(e.ct));
    await writeFile(PLAIN, JSON.stringify(JSON.parse(new TextDecoder().decode(pt)), null, 1));
    console.log("расшифровано →", path.relative(root, PLAIN), "(не коммитить, файл в .gitignore)");
  } catch { console.error("Неверный пароль"); process.exitCode = 1; }
} else {
  console.log("usage: node tools/crypt.mjs encrypt|decrypt");
  process.exitCode = 1;
}
