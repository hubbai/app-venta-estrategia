"use client";

/* Desambiguador de la Ad Library.

   Buscar "resilient" trae varios anunciantes con nombres parecidos, y el
   conteo de anuncios solo es real cuando se pide por page_id (la búsqueda por
   palabra clave subcuenta: trae únicamente los anuncios cuyo TEXTO matchea).
   Por eso, si el anunciante que agarró solo no es el correcto, aquí eliges el
   bueno y se vuelve a scrapear con su page_id. */

import { useState } from "react";

type Company = {
  page_id: string;
  name: string;
  category?: string;
  image_uri?: string;
  likes?: number;
  verification?: string;
  ig_username?: string;
};

export default function AdvertiserPicker({
  brand,
  currentPageId,
  onPick,
  disabled,
}: {
  brand: string;
  currentPageId?: string;
  onPick: (pageId: string) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState(brand);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/anunciantes?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo buscar.");
    setCompanies(data.companies ?? []);
  }

  return (
    <div className="border-t border-line pt-4">
      <span className="label">¿Es el anunciante correcto?</span>
      <p className="mb-3 text-xs text-fg-faint">
        {currentPageId ? (
          <>
            Se está usando el page_id <code className="text-iris">{currentPageId}</code>. Si los anuncios de arriba no
            son de esta marca, busca el bueno.
          </>
        ) : (
          <>Todavía no se resolvió ningún anunciante. Búscalo para traer sus anuncios activos.</>
        )}
      </p>

      <div className="flex gap-2">
        <input
          className="field flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre del anunciante en Meta"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={search} disabled={busy || disabled}>
          {busy ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {companies && (
        <div className="mt-3 space-y-2">
          {companies.length === 0 && <p className="text-xs text-fg-faint">Ningún anunciante con ese nombre.</p>}
          {companies.map((c) => {
            const active = c.page_id === currentPageId;
            return (
              <div key={c.page_id} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image_uri ? (
                  <img src={c.image_uri} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-surface" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {c.name}
                    {c.verification?.includes("VERIFIED") && <span className="ml-1 text-acid-dim">✓</span>}
                  </div>
                  <div className="truncate text-xs text-fg-faint">
                    {[c.category, c.ig_username && `@${c.ig_username}`, c.likes && `${c.likes.toLocaleString("es-MX")} likes`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={active || disabled}
                  onClick={() => onPick(c.page_id)}
                  className="shrink-0 text-xs font-semibold text-iris hover:underline disabled:text-fg-faint disabled:no-underline"
                >
                  {active ? "En uso" : "Usar este"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
