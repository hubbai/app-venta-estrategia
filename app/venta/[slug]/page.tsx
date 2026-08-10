import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import VentaEditor from "./VentaEditor";
import { getProject } from "@/lib/projects";
import { getVenta } from "@/lib/venta/store";
import { emptyResearch } from "@/lib/venta/types";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scrape?: string }>;
}) {
  await requireSession();
  const { slug } = await params;
  const { scrape } = await searchParams;

  const project = await getProject(slug);
  if (!project || project.kind !== "venta") notFound();

  const doc = await getVenta(project.id);

  return (
    <>
      <AppHeader />
      <VentaEditor
        project={{
          slug: project.slug,
          brand: project.brand,
          status: project.status,
        }}
        initialResearch={doc?.research ?? emptyResearch(project.brand)}
        initialDeck={doc?.deck ?? null}
        engine={doc?.engine ?? null}
        publicBase={process.env.NEXT_PUBLIC_SITE_BASE || "https://fs.hubb.mx"}
        autoScrape={scrape === "1"}
      />
    </>
  );
}
