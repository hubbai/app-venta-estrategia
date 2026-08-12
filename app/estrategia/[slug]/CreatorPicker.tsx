"use client";

/* Selector de creadores contra la base de hubb.

   Lo que se elige se congela dentro de la estrategia (nombre, precio, redes,
   foto): si el creador cambia en hubb, la propuesta que ya mandaste sigue
   diciendo lo mismo que cuando la mandaste. */

import { useState } from "react";
import type { Creador } from "@/lib/estrategia/types";

type HubbCreator = {
  id: string;
  name: string;
  avatar?: string | null;
  location?: string;
  categories?: string[];
  instagramFollowers?: string | null;
  tiktokFollowers?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  portfolioItems?: number;
  portfolioUrl?: string;
  verified?: boolean;
};

function toCreador(c: HubbCreator): Creador {
  const price =
    c.priceMin && c.priceMax && c.priceMin !== c.priceMax
      ? `$${c.priceMin.toLocaleString("es-MX")} – $${c.priceMax.toLocaleString("es-MX")}`
      : c.priceMin
        ? `$${c.priceMin.toLocaleString("es-MX")}`
        : "Por consultar";

  return {
    id: c.id,
    name: c.name,
    location: c.location,
    price,
    categories: c.categories ?? [],
    instagram: c.instagramFollowers ?? undefined,
    tiktok: c.tiktokFollowers ?? undefined,
    videos: c.portfolioItems,
    avatar: c.avatar ?? null,
    verified: c.verified,
    portfolioUrl: c.portfolioUrl,
  };
}

export default function CreatorPicker({
  selected,
  onChange,
  enabled,
}: {
  selected: Creador[];
  onChange: (c: Creador[]) => void;
  enabled: boolean;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [results, setResults] = useState<HubbCreator[] | null>(null);
  const [page, setPage] = useState<{ total: number; hasMore: boolean; seed: string }>({
    total: 0,
    hasMore: false,
    seed: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = new Set(selected.map((c) => c.id));

  /* `more` decide si esto es una búsqueda nueva o la siguiente página. hubb
     ordena al azar con semilla, así que paginar exige reenviar la misma semilla
     y el offset; sin eso saldrían repetidos. */
  async function search(more = false) {
    setBusy(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (state) params.set("state", state);
    if (more) {
      params.set("offset", String(results?.length ?? 0));
      if (page.seed) params.set("seed", page.seed);
    }
    const res = await fetch(`/api/creadores?${params}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo buscar en hubb.");
    const batch: HubbCreator[] = data.creators ?? [];
    setResults(more ? [...(results ?? []), ...batch] : batch);
    setPage({ total: data.total ?? batch.length, hasMore: Boolean(data.hasMore), seed: data.seed ?? "" });
  }

  if (!enabled) {
    return (
      <p className="text-sm text-fg-muted">
        Falta conectar hubb (<code className="text-iris">HUBB_API_URL</code> y{" "}
        <code className="text-iris">HUBB_API_TOKEN</code>). Mientras tanto la sección de creadores sale vacía en la
        propuesta.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Elegidos */}
      <div>
        <span className="label">
          Elegidos ({selected.length}) — se muestran en este orden
        </span>
        {selected.length === 0 ? (
          <p className="text-xs text-fg-faint">Ninguno todavía. Búscalos abajo.</p>
        ) : (
          <div className="space-y-2">
            {selected.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.avatar ? <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-surface" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-fg-faint">
                    {[c.location, c.price, c.categories?.join(", ")].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...selected];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      onChange(next);
                    }}
                    className="px-1.5 text-fg-faint hover:text-fg disabled:opacity-30"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === selected.length - 1}
                    onClick={() => {
                      const next = [...selected];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      onChange(next);
                    }}
                    className="px-1.5 text-fg-faint hover:text-fg disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(selected.filter((x) => x.id !== c.id))}
                    className="pl-2 text-xs text-danger hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buscador */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex flex-wrap gap-2 border-t border-line pt-5"
      >
        <input
          className="field flex-1"
          placeholder="Nicho, nombre o ciudad: running, Monterrey…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {/* Este filtro es por ESTADO, no por ciudad; la ciudad la agarra el buscador de arriba. */}
        <input className="field w-40" placeholder="Estado" value={state} onChange={(e) => setState(e.target.value)} />
        <button type="submit" disabled={busy} className="btn btn-ghost">
          {busy ? "Buscando…" : "Buscar en hubb"}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {results && (
        <div>
          <span className="label">
            {page.total > results.length
              ? `${results.length} de ${page.total.toLocaleString("es-MX")} resultados`
              : `${results.length} resultados`}
          </span>
          {results.length === 0 && <p className="text-xs text-fg-faint">Nada con esos filtros.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((c) => {
              const already = chosen.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={already}
                  onClick={() => onChange([...selected, toCreador(c)])}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2 text-left transition-colors hover:border-line-strong disabled:opacity-45"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.avatar ? <img src={c.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-surface-2" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-fg-faint">
                      {[c.location, c.categories?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-iris">{already ? "Ya está" : "+ Agregar"}</span>
                </button>
              );
            })}
          </div>
          {page.hasMore && (
            <button type="button" onClick={() => search(true)} disabled={busy} className="btn btn-ghost mt-3 w-full">
              {busy ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
