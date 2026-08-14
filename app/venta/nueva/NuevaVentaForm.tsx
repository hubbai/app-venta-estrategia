"use client";

/* El alta.

   La página web va primero y con su propio botón: de ahí salen la marca y qué
   venden, que son los campos que más se teclean. Los handles se proponen solo
   si se pudieron verificar contra la cuenta real — ver lib/venta/autocompletar.ts
   para por qué no se adivinan. */

import { useRouter } from "next/navigation";
import { useState } from "react";

type Form = {
  brand: string;
  site: string;
  industry: string;
  instagramHandle: string;
  tiktokHandle: string;
  /* No se teclea: lo llena el autocompletado para que el research vaya directo
     a la Ad Library correcta sin pasar por el desambiguador. */
  adPageId: string;
};

export default function NuevaVentaForm() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    brand: "",
    site: "",
    industry: "",
    instagramHandle: "",
    tiktokHandle: "",
    adPageId: "",
  });
  const [fuentes, setFuentes] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "auto" | "crear">(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    // Si lo editas a mano, deja de ser "leído de tu página".
    if (fuentes[k]) setFuentes(({ [k]: _, ...resto }) => resto);
  };

  async function autocompletar() {
    if (!form.site.trim()) return setError("Pon primero la página web.");
    setBusy("auto");
    setError(null);
    setAviso(null);

    const res = await fetch("/api/venta/autocompletar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: form.site }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error || "No se pudo leer la página.");

    // Lo que ya escribiste gana: esto propone, no pisa.
    setForm((f) => ({
      ...f,
      brand: f.brand || data.brand || "",
      industry: f.industry || data.industry || "",
      instagramHandle: f.instagramHandle || data.instagramHandle || "",
      tiktokHandle: f.tiktokHandle || data.tiktokHandle || "",
      adPageId: data.adPageId || f.adPageId,
    }));
    setFuentes(data.fuentes ?? {});
    setAviso(data.aviso ?? null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("crear");
    setError(null);
    const res = await fetch("/api/venta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo crear.");
      setBusy(null);
      return;
    }
    router.push(`/venta/${data.slug}?scrape=1`);
  }

  const Fuente = ({ campo }: { campo: keyof Form }) =>
    fuentes[campo] ? <span className="ml-2 text-[11px] font-normal normal-case text-iris">✓ {fuentes[campo]}</span> : null;

  return (
    <form onSubmit={onSubmit} className="card mt-8 space-y-5 p-6">
      <div>
        <label className="label" htmlFor="site">
          Página web
        </label>
        <div className="flex gap-2">
          <input
            id="site"
            autoFocus
            className="field flex-1"
            placeholder="resilientclub.com"
            value={form.site}
            onChange={set("site")}
            onKeyDown={(e) => {
              // Enter aquí autocompleta; no manda el formulario a medias.
              if (e.key === "Enter") {
                e.preventDefault();
                void autocompletar();
              }
            }}
          />
          <button type="button" onClick={autocompletar} disabled={busy !== null} className="btn btn-ghost shrink-0">
            {busy === "auto" ? "Leyendo…" : "Llenar solo"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-fg-faint">
          De aquí saco la marca y qué venden. Los handles solo si puedo verificarlos.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="brand">
          Marca <Fuente campo="brand" />
        </label>
        <input id="brand" required className="field" placeholder="RESILIENT" value={form.brand} onChange={set("brand")} />
      </div>

      <div>
        <label className="label" htmlFor="industry">
          Qué venden <Fuente campo="industry" />
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
            Instagram <Fuente campo="instagramHandle" />
          </label>
          <input id="ig" className="field" placeholder="@resilient_tm" value={form.instagramHandle} onChange={set("instagramHandle")} />
        </div>
        <div>
          <label className="label" htmlFor="tt">
            TikTok <Fuente campo="tiktokHandle" />
          </label>
          <input id="tt" className="field" placeholder="@rslnt_mx" value={form.tiktokHandle} onChange={set("tiktokHandle")} />
        </div>
      </div>

      {aviso && <p className="rounded-lg border border-line bg-surface-2 p-3 text-xs text-fg-muted">{aviso}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={busy !== null} className="btn btn-primary w-full">
        {busy === "crear" ? "Creando…" : "Crear y buscar datos"}
      </button>
    </form>
  );
}
