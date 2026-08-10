import AppHeader from "@/components/AppHeader";
import StyleNotes, { type Note } from "./StyleNotes";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EstiloPage() {
  await requireSession();

  const notes = await sql<Note[]>`
    select s.id, s.scope, s.note, s.created_at, u.name as author
    from style_notes s
    left join users u on u.id = s.created_by
    order by s.created_at asc
  `.catch(() => [] as Note[]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="eyebrow mb-2">Ajustes</div>
        <h1 className="text-3xl font-bold tracking-tight">
          Notas de <span className="hl">estilo</span>
        </h1>
        <p className="mt-2 text-fg-muted">
          Correcciones sobre cómo debe sonar el copy. Se leen antes de cada generación y{" "}
          <b>pesan más que las reglas base</b>: si una nota contradice una regla vieja, gana la nota. Aplican desde la
          siguiente presentación, no reescriben las ya publicadas.
        </p>

        <StyleNotes initial={[...notes]} />
      </main>
    </>
  );
}
