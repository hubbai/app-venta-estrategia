"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NuevaVentaForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    brand: "",
    site: "",
    industry: "",
    instagramHandle: "",
    tiktokHandle: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/venta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo crear.");
      setBusy(false);
      return;
    }
    router.push(`/venta/${data.slug}?scrape=1`);
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 space-y-5 p-6">
      <div>
        <label className="label" htmlFor="brand">
          Marca
        </label>
        <input id="brand" required autoFocus className="field" placeholder="RESILIENT" value={form.brand} onChange={set("brand")} />
      </div>

      <div>
        <label className="label" htmlFor="site">
          Página web
        </label>
        <input id="site" type="url" className="field" placeholder="https://resilient.mx" value={form.site} onChange={set("site")} />
      </div>

      <div>
        <label className="label" htmlFor="industry">
          Qué venden
        </label>
        <input
          id="industry"
          className="field"
          placeholder="ropa deportiva premium para running, DTC en México ($749-$1,299)"
          value={form.industry}
          onChange={set("industry")}
        />
        <p className="mt-1.5 text-xs text-fg-faint">
          Entre más específico, mejores salen las ideas de script. Precio y canal ayudan mucho.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ig">
            Instagram
          </label>
          <input id="ig" className="field" placeholder="@resilient.mx" value={form.instagramHandle} onChange={set("instagramHandle")} />
        </div>
        <div>
          <label className="label" htmlFor="tt">
            TikTok
          </label>
          <input id="tt" className="field" placeholder="@rslnt_mx" value={form.tiktokHandle} onChange={set("tiktokHandle")} />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creando…" : "Crear y buscar datos"}
      </button>
    </form>
  );
}
