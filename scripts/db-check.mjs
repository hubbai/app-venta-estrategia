/* db-check.mjs — Corre la migración y un round-trip completo contra un
   Postgres real en WASM (PGlite), sin Docker ni servidor instalado.

   Sirve para validar el SQL de verdad —las transacciones, el jsonb, los
   fragmentos condicionales de postgres.js— antes de apuntarle a Neon.

   Uso:  node scripts/db-check.mjs */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { pgOptions } from "../lib/pg-options.mjs";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Puerto efímero en vez de uno fijo: si tienes un Postgres propio corriendo,
   esto no choca con él ni te obliga a apagarlo. */
const PORT = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

let fails = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond || !detail ? "" : ` — ${detail}`}`);
  if (!cond) fails++;
}

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
await server.start();

const url = `postgres://postgres@127.0.0.1:${PORT}/postgres`;
const sql = postgres(url, pgOptions(url, { max: 1 }));

try {
  // ── Migración ──────────────────────────────────────────────────────
  const files = fs.readdirSync(path.join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await sql.unsafe(fs.readFileSync(path.join(ROOT, "migrations", f), "utf8"));
    console.log(`  aplicada ${f}`);
  }

  const tables = (
    await sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`
  ).map((r) => r.table_name);
  check(
    "migración crea las 7 tablas",
    ["assets", "estrategia", "projects", "renders", "research", "style_notes", "users"].every((t) => tables.includes(t)),
    tables.join(", ")
  );

  // ── Usuario (mismo camino que scripts/seed-user.mjs) ────────────────
  const hash = await bcrypt.hash("contraseña-de-prueba", 12);
  const [user] = await sql`
    insert into users (email, password_hash, name, role)
    values ('hola@hubb.mx', ${hash}, 'Marcelo', 'admin')
    returning id, email, role
  `;
  check("gen_random_uuid() sin pgcrypto", Boolean(user.id));
  check("el hash de bcrypt vuelve a validar", await bcrypt.compare("contraseña-de-prueba", hash));

  // Upsert por email: es como se resetea una contraseña.
  const [again] = await sql`
    insert into users (email, password_hash, name, role)
    values ('hola@hubb.mx', ${hash}, 'Marcelo Garza', 'admin')
    on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name
    returning id, name
  `;
  check("re-dar de alta el mismo correo actualiza, no duplica", again.id === user.id && again.name === "Marcelo Garza");

  // ── Proyecto ────────────────────────────────────────────────────────
  const [project] = await sql`
    insert into projects (slug, brand, kind, created_by)
    values ('resilient', 'RESILIENT', 'venta', ${user.id})
    returning *
  `;
  check("proyecto creado en draft", project.status === "draft" && project.published_at === null);

  const dup = await sql`select 1 from projects where slug = 'resilient'`;
  check("el slug es único", dup.length === 1);

  const bad = await sql`insert into projects (slug, brand, kind) values ('x','X','otro') returning id`.catch(() => null);
  check("el check de kind rechaza valores inventados", bad === null);

  // ── research: jsonb con sql.json() ──────────────────────────────────
  const doc = {
    research: { brand: "RESILIENT", adCount: 23, organic: { brand: [{ views: "1,227" }], creators: [] } },
    deck: null,
  };
  await sql`
    insert into research (project_id, data) values (${project.id}, ${sql.json(doc)})
    on conflict (project_id) do update set data = excluded.data, updated_at = now()
  `;
  const [{ data: readBack }] = await sql`select data from research where project_id = ${project.id}`;
  check("el jsonb sobrevive el round-trip", readBack.research.adCount === 23 && readBack.research.organic.brand[0].views === "1,227");

  // El upsert es el camino de "guardar" del editor: se llama muchas veces.
  await sql`
    insert into research (project_id, data) values (${project.id}, ${sql.json({ ...doc, deck: { s1: {} } })})
    on conflict (project_id) do update set data = excluded.data, updated_at = now()
  `;
  const rows = await sql`select data from research where project_id = ${project.id}`;
  check("guardar dos veces actualiza una sola fila", rows.length === 1 && rows[0].data.deck !== null);

  // ── Publicar: la transacción de publishProject ──────────────────────
  await sql.begin(async (tx) => {
    await tx`
      insert into renders (project_id, html, rendered_at) values (${project.id}, '<html>v1</html>', now())
      on conflict (project_id) do update set html = excluded.html, rendered_at = now()
    `;
    await tx`
      update projects set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
      where id = ${project.id}
    `;
  });

  const [published] = await sql`
    select r.html from renders r join projects p on p.id = r.project_id
    where p.slug = 'resilient' and p.status = 'published'
  `;
  check("getPublishedHtml devuelve lo publicado", published?.html === "<html>v1</html>");

  const firstPublishedAt = (await sql`select published_at from projects where id = ${project.id}`)[0].published_at;
  await sql.begin(async (tx) => {
    await tx`
      insert into renders (project_id, html, rendered_at) values (${project.id}, '<html>v2</html>', now())
      on conflict (project_id) do update set html = excluded.html, rendered_at = now()
    `;
    await tx`update projects set status='published', published_at = coalesce(published_at, now()) where id = ${project.id}`;
  });
  const [republished] = await sql`select html from renders where project_id = ${project.id}`;
  const secondPublishedAt = (await sql`select published_at from projects where id = ${project.id}`)[0].published_at;
  check("republicar pisa el HTML", republished.html === "<html>v2</html>");
  check("republicar conserva la fecha de publicación original", +firstPublishedAt === +secondPublishedAt);

  // Despublicar deja el borrador vivo.
  await sql`update projects set status = 'draft' where id = ${project.id}`;
  const hidden = await sql`
    select r.html from renders r join projects p on p.id = r.project_id
    where p.slug = 'resilient' and p.status = 'published'
  `;
  check("despublicado ya no se sirve", hidden.length === 0);
  check("…pero el research sigue ahí", (await sql`select 1 from research where project_id = ${project.id}`).length === 1);
  await sql`update projects set status = 'published' where id = ${project.id}`;

  // ── listProjects: el fragmento condicional de postgres.js ───────────
  await sql`insert into projects (slug, brand, kind, created_by) values ('resilient-estrategia','RESILIENT','estrategia',${user.id})`;

  const listAll = await sql`
    select p.*, u.name as author from projects p
    left join users u on u.id = p.created_by
    ${undefined ? sql`where p.kind = ${"venta"}` : sql``}
    order by p.updated_at desc limit 500
  `;
  const listVenta = await sql`
    select p.*, u.name as author from projects p
    left join users u on u.id = p.created_by
    ${sql`where p.kind = ${"venta"}`}
    order by p.updated_at desc limit 500
  `;
  check("listProjects sin filtro trae todo", listAll.length === 2);
  check("listProjects filtrado por kind funciona", listVenta.length === 1 && listVenta[0].kind === "venta");
  check("el join trae el autor", listVenta[0].author === "Marcelo Garza");

  // ── /api/public/index ───────────────────────────────────────────────
  const index = await sql`
    select p.slug, p.brand, p.kind, coalesce(p.published_at, p.updated_at) as date
    from projects p where p.status = 'published' order by date desc limit 500
  `;
  check("el índice público solo lista publicados", index.length === 1 && index[0].slug === "resilient");

  // ── Notas de estilo ─────────────────────────────────────────────────
  await sql`insert into style_notes (scope, note, created_by) values ('venta', 'Nada de la palabra oportunidad.', ${user.id})`;
  const notes = await sql`select note from style_notes where scope = 'venta' order by created_at asc`;
  check("las notas de estilo se leen por scope", notes.length === 1);
  const badScope = await sql`insert into style_notes (scope, note) values ('otro','x')`.catch(() => null);
  check("el check de scope rechaza valores inventados", badScope === null);

  // ── Borrar en cascada ───────────────────────────────────────────────
  await sql`insert into assets (project_id, kind, blob_url) values (${project.id}, 'ad', 'https://blob/x.jpg')`;
  await sql`delete from projects where id = ${project.id}`;
  const leftovers =
    (await sql`select 1 from research where project_id = ${project.id}`).length +
    (await sql`select 1 from renders where project_id = ${project.id}`).length +
    (await sql`select 1 from assets where project_id = ${project.id}`).length;
  check("borrar el proyecto se lleva research, render y assets", leftovers === 0);

  const survivor = await sql`select 1 from users where id = ${user.id}`;
  check("…pero no se lleva al usuario que lo creó", survivor.length === 1);
} catch (err) {
  console.error("\n✗ Reventó:", err.message);
  fails++;
} finally {
  await sql.end();
  await server.stop();
  await db.close();
}

console.log(fails === 0 ? "\nEl esquema y las consultas funcionan contra un Postgres real." : `\n${fails} fallo(s).`);
process.exit(fails === 0 ? 0 : 1);
