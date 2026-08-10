import AppHeader from "@/components/AppHeader";
import NuevaVentaForm from "./NuevaVentaForm";
import { requireSession } from "@/lib/session";
import { scrapeReady } from "@/lib/scrape/scrapecreators";

export const dynamic = "force-dynamic";

export default async function NuevaVenta() {
  await requireSession();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <div className="eyebrow mb-2">Nueva llamada de venta</div>
        <h1 className="text-3xl font-bold tracking-tight">¿Qué marca vas a analizar?</h1>
        <p className="mt-2 text-fg-muted">
          Con esto arranca el research. Después puedes corregir todo desde el editor antes de publicar.
        </p>

        {!scrapeReady() && (
          <div className="card mt-6 p-5 text-sm text-fg-muted">
            Falta <code className="text-iris">SCRAPECREATORS_API_KEY</code>: se crea igual, pero los datos los capturas
            a mano en el editor.
          </div>
        )}

        <NuevaVentaForm />
      </main>
    </>
  );
}
