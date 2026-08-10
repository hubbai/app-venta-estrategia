/* db.ts — Un solo cliente de Postgres para toda la app.

   Se usa `postgres` (TCP) en vez del driver serverless de Neon porque el mismo
   cliente sirve para las route handlers, los scripts de migración y el seed,
   sin cambiar de API ni depender de WebSockets. Las route handlers corren en
   Node runtime (el default), así que TCP está disponible.

   La conexión es perezosa a propósito: `next build` importa estos módulos para
   recolectar rutas y no queremos que reviente por no tener DATABASE_URL en el
   entorno de build. */
import postgres, { type Sql } from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: Sql | undefined;
}

let client: Sql | undefined;

function client_(): Sql {
  if (globalThis.__sql) return globalThis.__sql;
  if (client) return client;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL. Copia .env.example a .env.local.");

  client = postgres(url, {
    ssl: url.includes("localhost") ? false : "require",
    // Serverless: pocas conexiones por instancia y que se suelten rápido.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  /* En dev, Next recarga los módulos en cada cambio; sin el global se abriría
     un pool nuevo por recarga hasta agotar las conexiones de Neon. */
  if (process.env.NODE_ENV !== "production") globalThis.__sql = client;
  return client;
}

/* Proxy sobre el cliente real: `sql` se puede llamar como tag de template
   (sql`select 1`) y también exponer sus métodos (sql.begin, sql.unsafe…),
   pero no abre la conexión hasta el primer uso. */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_t, _this, args: Parameters<Sql>) {
    return (client_() as (...a: Parameters<Sql>) => unknown)(...args);
  },
  get(_t, prop: string | symbol) {
    const c = client_();
    const value = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  },
}) as Sql;

export function dbReady(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
