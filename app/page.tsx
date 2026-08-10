import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ProjectGrid from "@/components/ProjectGrid";
import { listProjects } from "@/lib/projects";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireSession();
  const all = await listProjects().catch(() => []);
  const ventas = all.filter((p) => p.kind === "venta");
  const estrategias = all.filter((p) => p.kind === "estrategia");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="eyebrow mb-2">Hola, {session.name.split(" ")[0]}</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Todo lo que le <span className="hl">enseñas</span> a una marca
        </h1>
        <p className="mt-2 max-w-xl text-fg-muted">
          El análisis para la llamada de venta, y la estrategia de Full Service una vez que pagan. Cada uno con su link
          para compartir.
        </p>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Llamadas de venta</h2>
              <p className="text-sm text-fg-muted">
                {ventas.length} {ventas.length === 1 ? "marca analizada" : "marcas analizadas"} · paid media y orgánico
              </p>
            </div>
            <Link href="/venta/nueva" className="btn btn-primary">
              + Nueva llamada
            </Link>
          </div>
          <ProjectGrid projects={ventas} emptyHref="/venta/nueva" emptyLabel="Analiza tu primera marca" />
        </section>

        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Estrategias</h2>
              <p className="text-sm text-fg-muted">
                {estrategias.length} {estrategias.length === 1 ? "propuesta" : "propuestas"} · para marcas que ya pagaron
              </p>
            </div>
            <Link href="/estrategia/nueva" className="btn btn-primary">
              + Nueva estrategia
            </Link>
          </div>
          <ProjectGrid projects={estrategias} emptyHref="/estrategia/nueva" emptyLabel="Arma la primera estrategia" />
        </section>
      </main>
    </>
  );
}
