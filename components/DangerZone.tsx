"use client";

/* Despublicar y borrar. Van juntos y al final del editor, separados del resto,
   porque son las dos únicas acciones que no se pueden deshacer:

   - Despublicar deja el link en 404 pero conserva el borrador.
   - Borrar se lleva research, render y assets (cascade en la DB). */

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DangerZone({
  slug,
  kind,
  brand,
  status,
  onUnpublished,
}: {
  slug: string;
  kind: "venta" | "estrategia";
  brand: string;
  status: "draft" | "published";
  onUnpublished: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unpublish() {
    if (!confirm(`El link de ${brand} va a dejar de funcionar. El borrador se queda. ¿Seguro?`)) return;
    setBusy(true);
    const res = await fetch(`/api/${kind}/${slug}/publish`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "No se pudo despublicar.");
    }
    onUnpublished();
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Se borra TODO lo de ${brand}: research, presentación y archivos. No se puede deshacer. ¿Seguro?`)) return;
    setBusy(true);
    const res = await fetch(`/api/${kind}/${slug}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "No se pudo borrar.");
    }
    router.replace(`/${kind}`);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] p-5">
      <h3 className="text-sm font-bold text-danger">Acciones que no se deshacen</h3>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {status === "published" && (
          <button type="button" onClick={unpublish} disabled={busy} className="btn btn-ghost text-danger">
            Despublicar
          </button>
        )}
        <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost text-danger">
          Borrar {brand}
        </button>
      </div>
      <p className="mt-3 text-xs text-fg-faint">
        Despublicar deja el link en 404 pero conserva lo que armaste. Borrar se lleva todo.
      </p>
    </div>
  );
}
