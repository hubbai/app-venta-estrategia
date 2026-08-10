import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import TeamManager, { type TeamMember } from "./TeamManager";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/");

  const members = await sql<TeamMember[]>`
    select id, email, name, role, created_at
    from users
    order by created_at asc
  `.catch(() => [] as TeamMember[]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="eyebrow mb-2">Admin</div>
        <h1 className="text-3xl font-bold tracking-tight">Equipo</h1>
        <p className="mt-2 text-fg-muted">
          Quién puede entrar a crear presentaciones y estrategias. Tú defines la contraseña y se la pasas; si vuelves a
          dar de alta un correo que ya existe, le cambias la contraseña.
        </p>

        <TeamManager members={[...members]} currentUserId={session.uid} />
      </main>
    </>
  );
}
