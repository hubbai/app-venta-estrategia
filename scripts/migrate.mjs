/* migrate.mjs — Aplica los .sql de migrations/ en orden, una sola vez cada uno.

   Sin ORM ni CLI extra: lleva el registro en la tabla _migrations y corre cada
   archivo dentro de una transacción, así una migración a medias no deja la DB
   en un estado raro.

   Uso:  npm run migrate */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { pgOptions } from "../lib/pg-options.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copia .env.example a .env.local y llénala.");
  process.exit(1);
}

const sql = postgres(url, pgOptions(url, { max: 1 }));

try {
  await sql`create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

  const applied = new Set((await sql`select name from _migrations`).map((r) => r.name));
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = fs.readFileSync(path.join(DIR, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into _migrations (name) values (${file})`;
    });
    console.log(`✓ ${file}`);
    ran++;
  }

  console.log(ran === 0 ? "Nada que aplicar, la DB está al día." : `${ran} migración(es) aplicadas.`);
} catch (err) {
  console.error("✗ Falló la migración:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
