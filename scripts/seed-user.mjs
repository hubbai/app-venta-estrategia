/* seed-user.mjs — Crea (o actualiza la contraseña de) una persona del equipo.

   Es la única forma de crear al PRIMER admin; de ahí en adelante se dan de
   alta desde /equipo. Si el email ya existe, le cambia la contraseña — sirve
   como "resetear password" cuando alguien la olvida.

   Uso:  npm run seed:user -- hola@hubb.mx 'unaContraseña' 'Marcelo Garza' admin */
import postgres from "postgres";
import { pgOptions } from "../lib/pg-options.mjs";
import bcrypt from "bcryptjs";

const [email, password, name, role = "member"] = process.argv.slice(2);

if (!email || !password || !name) {
  console.error("Uso: npm run seed:user -- <email> <password> <nombre> [admin|member]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña necesita al menos 8 caracteres.");
  process.exit(1);
}
if (role !== "admin" && role !== "member") {
  console.error("El rol debe ser 'admin' o 'member'.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, pgOptions(url, { max: 1 }));

try {
  const hash = await bcrypt.hash(password, 12);
  const [row] = await sql`
    insert into users (email, password_hash, name, role)
    values (${email.toLowerCase()}, ${hash}, ${name}, ${role})
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          name = excluded.name,
          role = excluded.role
    returning email, name, role
  `;
  console.log(`✓ ${row.email} — ${row.name} (${row.role})`);
} catch (err) {
  console.error("✗", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
