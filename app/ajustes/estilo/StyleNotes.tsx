"use client";

import { useState } from "react";

export type Note = {
  id: string;
  scope: "venta" | "estrategia";
  note: string;
  author: string | null;
  created_at: string;
};

const SCOPE_LABEL = {
  venta: "Llamadas de venta",
  estrategia: "Estrategias",
} as const;

const PLACEHOLDER = {
  venta: 'Ej. "No uses la palabra oportunidad en los subtítulos, suena a vendedor."',
  estrategia: 'Ej. "Los pasos van en presente, no en futuro: se revisa, no se revisará."',
} as const;

export default function StyleNotes({ initial }: { initial: Note[] }) {
  const [notes, setNotes] = useState(initial);
  const [scope, setScope] = useState<"venta" | "estrategia">("venta");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/estilo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, note: draft }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo guardar.");
    setNotes([...notes, data.note]);
    setDraft("");
  }

  async function remove(id: string) {
    setNotes(notes.filter((n) => n.id !== id));
    await fetch("/api/estilo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  return (
    <>
      <form onSubmit={add} className="card mt-8 space-y-4 p-6">
        <div className="flex gap-2">
          {(["venta", "estrategia"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                scope === s ? "bg-acid text-on-accent" : "bg-surface-2 text-fg-muted hover:text-fg"
              }`}
            >
              {SCOPE_LABEL[s]}
            </button>
          ))}
        </div>

        <textarea
          className="field resize-y"
          rows={3}
          placeholder={PLACEHOLDER[scope]}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary">
          {busy ? "Guardando…" : "Agregar nota"}
        </button>
      </form>

      {(["venta", "estrategia"] as const).map((s) => {
        const list = notes.filter((n) => n.scope === s);
        return (
          <section key={s} className="mt-10">
            <h2 className="text-lg font-bold tracking-tight">{SCOPE_LABEL[s]}</h2>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-fg-faint">Sin notas. El copy usa solo las reglas base.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {list.map((n, i) => (
                  <li key={n.id} className="card flex items-start gap-3 p-4">
                    <span className="shrink-0 text-sm font-bold text-fg-faint">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{n.note}</p>
                      {n.author && <p className="mt-1 text-xs text-fg-faint">{n.author}</p>}
                    </div>
                    <button type="button" onClick={() => remove(n.id)} className="shrink-0 text-xs text-danger hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </>
  );
}
