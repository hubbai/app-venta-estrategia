import AppHeader from "@/components/AppHeader";
import NuevaEstrategiaForm from "./NuevaEstrategiaForm";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NuevaEstrategia() {
  await requireSession();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-xl px-5 py-12">
        <div className="eyebrow mb-2">Nueva estrategia</div>
        <h1 className="text-3xl font-bold tracking-tight">¿Para qué marca?</h1>
        <p className="mt-2 text-fg-muted">
          En el siguiente paso subes el documento de Henry y la app arma la propuesta a partir de ahí.
        </p>
        <NuevaEstrategiaForm />
      </main>
    </>
  );
}
