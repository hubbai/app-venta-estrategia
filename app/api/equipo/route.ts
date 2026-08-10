/* Alta y baja de gente del equipo. Solo admins.

   No hay flujo de invitación por correo: el admin define la contraseña y se la
   pasa a la persona. Es lo más simple que funciona para un equipo chico, y
   evita depender de un proveedor de email. */
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { email, password, name, role } = (await req.json()) as Record<string, string>;

    if (!email?.trim() || !password || !name?.trim()) {
      return Response.json({ error: "Faltan correo, nombre o contraseña." }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: "La contraseña necesita al menos 8 caracteres." }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const rows = await sql<{ id: string; email: string; name: string; role: string }[]>`
      insert into users (email, password_hash, name, role)
      values (${email.trim().toLowerCase()}, ${hash}, ${name.trim()}, ${role === "admin" ? "admin" : "member"})
      on conflict (email) do update
        set password_hash = excluded.password_hash,
            name = excluded.name,
            role = excluded.role
      returning id, email, name, role
    `;

    console.log(`[equipo] ${admin.email} dio de alta a ${rows[0].email}`);
    return Response.json({ user: rows[0] });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const { id } = (await req.json()) as { id?: string };
    if (!id) return Response.json({ error: "Falta el id." }, { status: 400 });

    // Quitarse a uno mismo dejaría al equipo potencialmente sin admin.
    if (id === admin.uid) {
      return Response.json({ error: "No puedes borrar tu propia cuenta." }, { status: 400 });
    }

    await sql`delete from users where id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
