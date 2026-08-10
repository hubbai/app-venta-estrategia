/* auth.ts — Sesión del equipo: contraseña con bcrypt y sesión en un JWT
   firmado que viaja en cookie httpOnly.

   El JWT se verifica con `jose`, que corre igual en el middleware (edge) y en
   las route handlers (node). El hash con bcrypt solo se toca en el login, que
   es node runtime. */
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "hubb_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export type Session = { uid: string; email: string; name: string; role: "admin" | "member" };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET. Genera uno con: openssl rand -base64 48");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const { uid, email, name, role } = payload as Record<string, unknown>;
    if (typeof uid !== "string" || typeof email !== "string") return null;
    return {
      uid,
      email,
      name: typeof name === "string" ? name : email,
      role: role === "admin" ? "admin" : "member",
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
