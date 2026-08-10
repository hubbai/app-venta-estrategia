/* Login. Compara el hash con bcrypt y deja la sesión en una cookie httpOnly.
   El mensaje de error es el mismo para email inexistente y contraseña mala:
   no queremos que sirva para averiguar quién tiene cuenta. */
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

type Row = { id: string; email: string; name: string; role: "admin" | "member"; password_hash: string };

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return Response.json({ error: "Faltan el correo o la contraseña." }, { status: 400 });
    }

    const rows = await sql<Row[]>`
      select id, email, name, role, password_hash
      from users
      where email = ${email.trim().toLowerCase()}
      limit 1
    `;
    const user = rows[0];
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !ok) {
      return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    const token = await signSession({ uid: user.id, email: user.email, name: user.name, role: user.role });
    (await cookies()).set(SESSION_COOKIE, token, cookieOptions);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[login]", err);
    return Response.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
