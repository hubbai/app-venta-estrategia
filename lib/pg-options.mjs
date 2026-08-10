/* pg-options.mjs — Opciones de conexión compartidas por la app y los scripts.

   Vive en .mjs (y no en .ts) porque scripts/migrate.mjs y scripts/seed-user.mjs
   corren con node pelado, sin pasar por el compilador de Next.

   El detalle importante es el SSL. Neon lo exige; un Postgres local no lo
   habla, y postgres.js, si le pides SSL contra un servidor que no lo soporta,
   NO falla: se queda esperando hasta agotar el connect_timeout y devuelve un
   "write CONNECT_TIMEOUT" que no dice nada del problema real. */

/** Hosts donde nunca hay SSL: la base corre en la misma máquina. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * @param {string} url Connection string de Postgres.
 * @returns {boolean|"require"} Lo que espera la opción `ssl` de postgres.js.
 */
export function sslFor(url) {
  let host = "";
  let sslmode = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    sslmode = parsed.searchParams.get("sslmode") || "";
  } catch {
    // Si la URL no parsea, que reviente después con un error claro del driver.
    return "require";
  }

  // Un sslmode explícito en la URL manda: es lo que el usuario pidió.
  if (sslmode === "disable") return false;
  if (sslmode) return "require";

  return LOOPBACK.has(host) ? false : "require";
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} [extra]
 */
export function pgOptions(url, extra = {}) {
  return {
    ssl: sslFor(url),
    // Serverless: pocas conexiones por instancia y que se suelten rápido.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ...extra,
  };
}
