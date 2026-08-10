/* session.ts — Lectura de la sesión desde el servidor (server components y
   route handlers). El middleware ya bloqueó a los anónimos; estas funciones
   son para saber QUIÉN es, no para decidir si pasa. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Session } from "./auth";

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/* Para páginas: si no hay sesión manda al login en vez de reventar. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/* Para route handlers: lanza y el handler responde 401. */
export async function requireSessionApi(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSessionApi();
  if (s.role !== "admin") throw new ForbiddenError();
  return s;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("No autenticado");
  }
}
export class ForbiddenError extends Error {
  constructor() {
    super("Necesitas ser admin");
  }
}

/* Traduce los errores de arriba (y cualquier otro) a una Response. */
export function apiError(err: unknown): Response {
  if (err instanceof UnauthorizedError) {
    return Response.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message }, { status: 403 });
  }
  const message = err instanceof Error ? err.message : "Error inesperado";
  console.error("[api]", err);
  return Response.json({ error: message }, { status: 500 });
}
