import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ProjectGrid from "@/components/ProjectGrid";
import { listProjects } from "@/lib/projects";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EstrategiaIndex() {
  await requireSession();
  const projects = await listProjects("estrategia").catch(() => []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Cuando ya pagaron</div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="hl">Estrategias</span> de Full Service
            </h1>
            <p className="mt-2 max-w-xl text-fg-muted">
              La propuesta completa: escenarios, entregables, los pasos del servicio y los creadores sugeridos.
            </p>
          </div>
          <Link href="/estrategia/nueva" className="btn btn-primary">
            + Nueva estrategia
          </Link>
        </div>

        <ProjectGrid projects={projects} emptyHref="/estrategia/nueva" emptyLabel="Arma la primera" />
      </main>
    </>
  );
}
