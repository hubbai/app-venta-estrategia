"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NuevaEstrategiaForm() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/estrategia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo crear.");
      setBusy(false);
      return;
    }
    router.push(`/estrategia/${data.slug}`);
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 space-y-5 p-6">
      <label className="block">
        <span className="label">Marca</span>
        <input className="field" required autoFocus placeholder="RESILIENT" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <span className="mt-1.5 block text-xs text-fg-faint">
          El link será <code>/r/{(brand || "marca").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-estrategia</code>
        </span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creando…" : "Crear"}
      </button>
    </form>
  );
}
