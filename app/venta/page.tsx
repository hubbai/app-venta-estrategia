import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ProjectGrid from "@/components/ProjectGrid";
import { listProjects } from "@/lib/projects";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VentaIndex() {
  await requireSession();
  const projects = await listProjects("venta").catch(() => []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Antes de la llamada</div>
            <h1 className="text-3xl font-bold tracking-tight">
              Llamadas de <span className="hl">venta</span>
            </h1>
            <p className="mt-2 max-w-xl text-fg-muted">
              Análisis de paid media y de orgánico de la marca, en 3 slides que se enseñan en vivo durante la llamada.
            </p>
          </div>
          <Link href="/venta/nueva" className="btn btn-primary">
            + Nueva llamada
          </Link>
        </div>

        <ProjectGrid projects={projects} emptyHref="/venta/nueva" emptyLabel="Analiza tu primera marca" />
      </main>
    </>
  );
}
