import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import EstrategiaEditor from "./EstrategiaEditor";
import { getProject } from "@/lib/projects";
import { getEstrategia } from "@/lib/estrategia/store";
import { emptyEstrategia } from "@/lib/estrategia/types";
import { requireSession } from "@/lib/session";
import { hubbReady } from "@/lib/hubb";

export const dynamic = "force-dynamic";

export default async function EstrategiaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;

  const project = await getProject(slug);
  if (!project || project.kind !== "estrategia") notFound();

  const doc = await getEstrategia(project.id);

  return (
    <>
      <AppHeader />
      <EstrategiaEditor
        project={{ slug: project.slug, brand: project.brand, status: project.status }}
        initial={doc?.data ?? emptyEstrategia(project.brand)}
        sourceDocUrl={doc?.sourceDocUrl ?? null}
        publicBase={process.env.NEXT_PUBLIC_SITE_BASE || "https://fs.hubb.mx"}
        creadoresDisponibles={hubbReady()}
      />
    </>
  );
}
