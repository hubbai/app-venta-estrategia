"use client";

/* Editor de la estrategia.

   Claude pre-llena desde el documento de Henry, pero todo queda editable: la
   propuesta la manda una persona, no el modelo. Cada sección es una lista con
   agregar / borrar / reordenar, porque no toda marca lleva dos escenarios ni
   los mismos 10 pasos. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Area, Section, Text } from "@/components/Field";
import CreatorPicker from "./CreatorPicker";
import DangerZone from "@/components/DangerZone";
import type { Escenario, Estrategia, Funcion, Linea, Panel, Paso, Row } from "@/lib/estrategia/types";

type Props = {
  project: { slug: string; brand: string; status: "draft" | "published" };
  initial: Estrategia;
  sourceDocUrl: string | null;
  publicBase: string;
  creadoresDisponibles: boolean;
};

export default function EstrategiaEditor({ project, initial, sourceDocUrl, publicBase, creadoresDisponibles }: Props) {
  const router = useRouter();
  const [e, setE] = useState<Estrategia>(initial);
  const [status, setStatus] = useState(project.status);
  const [busy, setBusy] = useState<null | "parse" | "save" | "publish">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [pasted, setPasted] = useState("");

  const set = <K extends keyof Estrategia>(k: K, v: Estrategia[K]) => setE((prev) => ({ ...prev, [k]: v }));
  const refreshPreview = () => setPreviewKey((k) => k + 1);

  async function save(silent = false) {
    setBusy("save");
    const res = await fetch(`/api/estrategia/${project.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estrategia: e }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg({ kind: "error", text: d.error || "No se pudo guardar." });
      return false;
    }
    if (!silent) setMsg({ kind: "ok", text: "Guardado." });
    refreshPreview();
    return true;
  }

  async function parseDoc(file?: File) {
    if (!file && !pasted.trim()) {
      return setMsg({ kind: "error", text: "Sube el PDF o pega el texto del documento." });
    }
    setBusy("parse");
    setMsg(null);
    const fd = new FormData();
    if (file) fd.set("file", file);
    if (!file) fd.set("text", pasted);

    const res = await fetch(`/api/estrategia/${project.slug}/parse`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "No se pudo leer el documento." });

    setE(data.estrategia);
    refreshPreview();
    setMsg({ kind: "ok", text: "Documento leído. Revisa sección por sección antes de publicar." });
  }

  async function publish() {
    if (!(await save(true))) return;
    setBusy("publish");
    const res = await fetch(`/api/estrategia/${project.slug}/publish`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "No se pudo publicar." });
    setStatus("published");
    router.refresh();
    setMsg({ kind: "ok", text: `Publicado en ${data.url}` });
  }

  const publicUrl = `${publicBase}/r/${project.slug}`;

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1">Estrategia</div>
          <h1 className="truncate text-2xl font-bold tracking-tight">{project.brand}</h1>
          <div className="mt-1 text-xs text-fg-faint">
            {status === "published" ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="text-iris underline">
                {publicUrl}
              </a>
            ) : (
              <>Sin publicar · el link será {publicUrl}</>
            )}
            {e.engine && <> · leído por {e.engine}</>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => save()} disabled={busy !== null}>
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className="btn btn-primary" onClick={publish} disabled={busy !== null}>
            {busy === "publish" ? "Publicando…" : status === "published" ? "Republicar" : "Publicar"}
          </button>
        </div>
      </div>

      {msg && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-2.5 text-sm ${
            msg.kind === "ok"
              ? "bg-[color-mix(in_srgb,var(--color-ok)_12%,transparent)] text-[var(--color-ok)]"
              : "bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          {/* ── Documento de Henry ── */}
          <Section title="Documento de Henry" subtitle="De aquí sale toda la propuesta" defaultOpen={!e.escenarios.length}>
            {sourceDocUrl && (
              <a href={sourceDocUrl} target="_blank" rel="noreferrer" className="block text-sm text-iris underline">
                Ver el documento que se usó ↗
              </a>
            )}
            <div>
              <span className="label">Sube el PDF</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain"
                disabled={busy !== null}
                className="block w-full text-xs text-fg-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fg"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) void parseDoc(f);
                  ev.target.value = "";
                }}
              />
              <span className="mt-1.5 block text-xs text-fg-faint">
                Si es un Word o un Google Doc, expórtalo a PDF: se parsea mucho mejor.
              </span>
            </div>

            <Area
              label="…o pega el texto"
              rows={5}
              value={pasted}
              onChange={setPasted}
              placeholder="Pega aquí el contenido del documento"
            />
            <button type="button" className="btn btn-ghost" onClick={() => parseDoc()} disabled={busy !== null || !pasted.trim()}>
              {busy === "parse" ? "Leyendo…" : "Armar propuesta con el texto pegado"}
            </button>
            <p className="text-xs text-fg-faint">
              Volver a leer el documento reescribe todas las secciones, pero conserva los creadores que ya elegiste.
            </p>
          </Section>

          {/* ── Portada ── */}
          <Section title="Portada" defaultOpen={Boolean(e.escenarios.length)}>
            <Text label="Título" value={e.title} onChange={(v) => set("title", v)} />
            <Area label="Entrada" rows={3} value={e.intro} onChange={(v) => set("intro", v)} />
          </Section>

          {/* ── Contexto ── */}
          <Section title="Contexto de marca" subtitle={`${e.contexto?.atributos?.length ?? 0} atributos`}>
            <Area
              label="Párrafos (uno por línea en blanco)"
              rows={6}
              value={(e.contexto?.paragraphs ?? []).join("\n\n")}
              onChange={(v) =>
                set("contexto", {
                  ...e.contexto,
                  paragraphs: v.split(/\n\s*\n/).filter(Boolean),
                  atributos: e.contexto?.atributos ?? [],
                  stats: e.contexto?.stats ?? [],
                })
              }
            />
            <Text
              label="Atributos (separados por coma)"
              value={(e.contexto?.atributos ?? []).join(", ")}
              onChange={(v) =>
                set("contexto", {
                  ...e.contexto,
                  paragraphs: e.contexto?.paragraphs ?? [],
                  atributos: v.split(",").map((s) => s.trim()).filter(Boolean),
                  stats: e.contexto?.stats ?? [],
                })
              }
              hint="Ligereza, Ventilación, Secado rápido…"
            />
            <ListEditor
              label="Datos duros"
              items={e.contexto?.stats ?? []}
              blank={{ value: "", label: "" }}
              onChange={(stats) =>
                set("contexto", {
                  ...e.contexto,
                  paragraphs: e.contexto?.paragraphs ?? [],
                  atributos: e.contexto?.atributos ?? [],
                  stats,
                })
              }
              render={(s, up) => (
                <>
                  <Text label="Número" value={s.value} onChange={(v) => up({ ...s, value: v })} placeholder="2,000+" />
                  <Text label="Qué significa" value={s.label} onChange={(v) => up({ ...s, label: v })} />
                </>
              )}
            />
          </Section>

          {/* ── Escenarios ── */}
          <Section title="Escenarios" subtitle={`${e.escenarios.length} propuestos`}>
            <ListEditor
              label=""
              items={e.escenarios}
              blank={{ tag: "Escenario", title: "", paragraphs: [], badges: [] } as Escenario}
              onChange={(v) => set("escenarios", v)}
              render={(s, up) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                    <Text label="Etiqueta" value={s.tag} onChange={(v) => up({ ...s, tag: v })} />
                    <Text label="Título" value={s.title} onChange={(v) => up({ ...s, title: v })} />
                  </div>
                  <Area
                    label="Párrafos"
                    rows={4}
                    value={(s.paragraphs ?? []).join("\n\n")}
                    onChange={(v) => up({ ...s, paragraphs: v.split(/\n\s*\n/).filter(Boolean) })}
                  />
                  <Text label="Badges (coma)" value={(s.badges ?? []).join(", ")} onChange={(v) => up({ ...s, badges: split(v) })} />
                  <Text label="Título del desglose" value={s.breakdownTitle} onChange={(v) => up({ ...s, breakdownTitle: v })} />
                  <ListEditor
                    label="Bloques del desglose"
                    items={s.breakdown ?? []}
                    blank={{ label: "", value: "", caption: "" }}
                    onChange={(breakdown) => up({ ...s, breakdown })}
                    render={(b, ub) => (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Text label="Etiqueta" value={b.label} onChange={(v) => ub({ ...b, label: v })} />
                        <Text label="Número" value={b.value} onChange={(v) => ub({ ...b, value: v })} />
                        <Text label="Pie" value={b.caption} onChange={(v) => ub({ ...b, caption: v })} />
                      </div>
                    )}
                  />
                  <Area label="Nota al pie" rows={2} value={s.note} onChange={(v) => up({ ...s, note: v })} />
                </>
              )}
            />
          </Section>

          {/* ── Entregables ── */}
          <Section title="Entregables lado a lado" subtitle={`${e.panels.length} paneles`}>
            <ListEditor
              label=""
              items={e.panels}
              blank={{ tag: "", title: "", entregables: [], operativos: [] } as Panel}
              onChange={(v) => set("panels", v)}
              render={(p, up) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                    <Text label="Etiqueta" value={p.tag} onChange={(v) => up({ ...p, tag: v })} />
                    <Text label="Título" value={p.title} onChange={(v) => up({ ...p, title: v })} />
                  </div>
                  <RowsEditor label="Entregables" rows={p.entregables} onChange={(entregables) => up({ ...p, entregables })} />
                  <RowsEditor label="Datos operativos" rows={p.operativos} onChange={(operativos) => up({ ...p, operativos })} />
                </>
              )}
            />
            <Area label="Nota al pie" rows={2} value={e.panelsNote} onChange={(v) => set("panelsNote", v)} />
          </Section>

          {/* ── Función de cada contenido ── */}
          <Section title="Función de cada contenido" subtitle={`${e.funciones.length} piezas`}>
            <ListEditor
              label=""
              items={e.funciones}
              blank={{ count: "", title: "", desc: "", scope: "" } as Funcion}
              onChange={(v) => set("funciones", v)}
              render={(f, up) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                    <Text label="Cantidad" value={f.count} onChange={(v) => up({ ...f, count: v })} />
                    <Text label="Título" value={f.title} onChange={(v) => up({ ...f, title: v })} />
                  </div>
                  <Area label="Qué trabajo hace" rows={2} value={f.desc} onChange={(v) => up({ ...f, desc: v })} />
                  <Text label="En qué escenarios" value={f.scope} onChange={(v) => up({ ...f, scope: v })} />
                </>
              )}
            />
          </Section>

          {/* ── Pasos ── */}
          <Section title="Pasos del servicio" subtitle={`${e.pasos.length} pasos`}>
            <ListEditor
              label=""
              items={e.pasos}
              blank={{ phase: "", tag: "", title: "", desc: "" } as Paso}
              onChange={(v) => set("pasos", v)}
              render={(p, up) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text label="Fase" value={p.phase} onChange={(v) => up({ ...p, phase: v })} placeholder="Paso 1 · Arranque" />
                    <Text label="Etiqueta" value={p.tag} onChange={(v) => up({ ...p, tag: v })} placeholder="Henry" />
                  </div>
                  <Text label="Título" value={p.title} onChange={(v) => up({ ...p, title: v })} />
                  <Area label="Descripción" rows={3} value={p.desc} onChange={(v) => up({ ...p, desc: v })} />
                  <Text label="Chips (coma)" value={(p.chips ?? []).join(", ")} onChange={(v) => up({ ...p, chips: split(v) })} />
                  <ListEditor
                    label="Diferencias por escenario"
                    items={p.variantes ?? []}
                    blank={{ label: "Esc. 1", text: "" }}
                    onChange={(variantes) => up({ ...p, variantes })}
                    render={(v, uv) => (
                      <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
                        <Text label="Cuál" value={v.label} onChange={(x) => uv({ ...v, label: x })} />
                        <Text label="Qué cambia" value={v.text} onChange={(x) => uv({ ...v, text: x })} />
                      </div>
                    )}
                  />
                </>
              )}
            />
          </Section>

          {/* ── Líneas creativas ── */}
          <Section title="Líneas creativas" subtitle={`${e.lineas.length} ángulos`}>
            <ListEditor
              label=""
              items={e.lineas}
              blank={{ title: "", desc: "" } as Linea}
              onChange={(v) => set("lineas", v)}
              render={(l, up) => (
                <>
                  <Text label="Título" value={l.title} onChange={(v) => up({ ...l, title: v })} />
                  <Area label="Descripción" rows={2} value={l.desc} onChange={(v) => up({ ...l, desc: v })} />
                </>
              )}
            />
          </Section>

          {/* ── Comparativa ── */}
          <Section title="Comparativa general" subtitle={e.comparativa ? `${e.comparativa.rows.length} filas` : "sin tabla"}>
            <Text
              label="Encabezados (coma)"
              value={(e.comparativa?.headers ?? []).join(", ")}
              onChange={(v) => set("comparativa", { headers: split(v), rows: e.comparativa?.rows ?? [] })}
              hint="Elemento, Escenario 1, Escenario 2"
            />
            <ListEditor
              label="Filas"
              items={e.comparativa?.rows ?? []}
              blank={[] as string[]}
              onChange={(rows) => set("comparativa", { headers: e.comparativa?.headers ?? [], rows })}
              render={(row, up) => (
                <Text
                  label="Celdas separadas por |"
                  value={row.join(" | ")}
                  onChange={(v) => up(v.split("|").map((s) => s.trim()))}
                  hint="Creadores totales | 10 | 30"
                />
              )}
            />
          </Section>

          {/* ── Creadores ── */}
          <Section title="Portafolios de creadores" subtitle={`${e.creadores.length} elegidos · desde hubb`}>
            <Area label="Nota de la sección" rows={2} value={e.creadoresNote} onChange={(v) => set("creadoresNote", v)} />
            <CreatorPicker selected={e.creadores} onChange={(v) => set("creadores", v)} enabled={creadoresDisponibles} />
          </Section>

          <DangerZone
            slug={project.slug}
            kind="estrategia"
            brand={project.brand}
            status={status}
            onUnpublished={() => setStatus("draft")}
          />
        </div>

        {/* ── Preview ── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Como se va a ver</span>
            <button type="button" onClick={refreshPreview} className="text-xs text-iris hover:underline">
              Actualizar preview
            </button>
          </div>
          <iframe
            key={previewKey}
            src={`/api/estrategia/${project.slug}/preview`}
            title="Preview de la estrategia"
            className="h-[78vh] w-full rounded-xl border border-line bg-[#FFFBF2]"
          />
          <p className="mt-2 text-xs text-fg-faint">Guarda para que el preview tome tus cambios.</p>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function split(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/* Lista editable genérica: agregar, borrar y reordenar cualquier sección. */
function ListEditor<T>({
  label,
  items,
  blank,
  onChange,
  render,
}: {
  label: string;
  items: T[];
  blank: T;
  onChange: (items: T[]) => void;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
}) {
  const update = (i: number) => (next: T) => onChange(items.map((x, j) => (j === i ? next : x)));
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i + d], next[i]] = [next[i], next[i + d]];
    onChange(next);
  };

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">#{i + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="px-1.5 text-fg-faint hover:text-fg disabled:opacity-30" aria-label="Subir">
                  ↑
                </button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="px-1.5 text-fg-faint hover:text-fg disabled:opacity-30" aria-label="Bajar">
                  ↓
                </button>
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="pl-2 text-xs text-danger hover:underline">
                  Borrar
                </button>
              </div>
            </div>
            {render(item, update(i))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, structuredClone(blank)])}
        className="mt-3 text-sm font-semibold text-iris hover:underline"
      >
        + Agregar
      </button>
    </div>
  );
}

function RowsEditor({ label, rows, onChange }: { label: string; rows: Row[]; onChange: (r: Row[]) => void }) {
  return (
    <ListEditor
      label={label}
      items={rows}
      blank={{ label: "", value: "" }}
      onChange={onChange}
      render={(r, up) => (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Text label="Concepto" value={r.label} onChange={(v) => up({ ...r, label: v })} />
          <Text label="Valor" value={r.value} onChange={(v) => up({ ...r, value: v })} />
        </div>
      )}
    />
  );
}
