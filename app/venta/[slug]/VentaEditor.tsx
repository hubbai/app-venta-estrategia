"use client";

/* El editor de la llamada de venta.

   Izquierda: el research y el copy, todo editable. Derecha: la presentación
   real en un iframe, para que veas exactamente lo que vas a proyectar.

   El flujo pensado es: Buscar datos → revisas y corriges → Escribir copy →
   ajustas los textos → Publicar. Nada se publica solo. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, Section, SourceBadge, Text } from "@/components/Field";
import AdvertiserPicker from "./AdvertiserPicker";
import DangerZone from "@/components/DangerZone";
import { LIMITS } from "@/lib/venta/limits";
import type { Deck, Research } from "@/lib/venta/types";

type Props = {
  project: { slug: string; brand: string; status: "draft" | "published" };
  initialResearch: Research;
  initialDeck: Deck | null;
  engine: string | null;
  publicBase: string;
  autoScrape: boolean;
};

export default function VentaEditor({ project, initialResearch, initialDeck, engine, publicBase, autoScrape }: Props) {
  const router = useRouter();
  const [research, setResearch] = useState<Research>(initialResearch);
  const [deck, setDeck] = useState<Deck | null>(initialDeck);
  const [status, setStatus] = useState(project.status);
  const [engineLabel, setEngineLabel] = useState(engine);

  const [busy, setBusy] = useState<null | "scrape" | "copy" | "save" | "publish">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const didAutoScrape = useRef(false);

  const patch = (p: Partial<Research>) => setResearch((r) => ({ ...r, ...p }));

  const refreshPreview = () => setPreviewKey((k) => k + 1);

  const save = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      setBusy("save");
      const res = await fetch(`/api/venta/${project.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research, deck }),
      });
      setBusy(null);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMsg({ kind: "error", text: d.error || "No se pudo guardar." });
        return false;
      }
      if (!opts.silent) setMsg({ kind: "ok", text: "Guardado." });
      refreshPreview();
      return true;
    },
    [project.slug, research, deck]
  );

  /* adPageId llega cuando corriges el anunciante en el desambiguador: obliga a
     releer la Ad Library por ese page_id en vez del que se adivinó. */
  const scrape = useCallback(async (adPageId?: string) => {
    setBusy("scrape");
    setMsg(null);
    const res = await fetch(`/api/venta/${project.slug}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adPageId ? { adPageId } : {}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "Falló la búsqueda." });

    setResearch(data.research);
    refreshPreview();

    const failed = Object.entries((data.sources ?? {}) as Record<string, string>)
      .filter(([, v]) => v === "fallo")
      .map(([k]) => k);
    // Con el motivo, no solo el bloque: casi siempre es un handle mal escrito,
    // y "Account doesn't exist" se arregla solo con leerlo.
    const why = (data.research?.sourceErrors ?? {}) as Record<string, string>;
    setMsg(
      failed.length
        ? {
            kind: "error",
            text: `Se trajo lo demás. Falló ${failed
              .map((k) => (why[k] ? `${k} (${why[k]})` : k))
              .join("; ")}. Llénalo a mano abajo.`,
          }
        : { kind: "ok", text: "Datos actualizados." }
    );
  }, [project.slug]);

  // Al llegar desde /venta/nueva, arranca la búsqueda sola.
  useEffect(() => {
    if (autoScrape && !didAutoScrape.current) {
      didAutoScrape.current = true;
      void scrape();
    }
  }, [autoScrape, scrape]);

  async function writeCopy() {
    setBusy("copy");
    setMsg(null);
    // Se guarda primero para que Claude lea el research corregido, no el viejo.
    await fetch(`/api/venta/${project.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ research, deck }),
    });
    const res = await fetch(`/api/venta/${project.slug}/copy`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "No se pudo escribir el copy." });
    setDeck(data.deck);
    setEngineLabel(data.engine);
    refreshPreview();
    setMsg({ kind: "ok", text: `Copy listo (${data.engine}). Revísalo antes de publicar.` });
  }

  async function publish() {
    if (!(await save({ silent: true }))) return;
    setBusy("publish");
    const res = await fetch(`/api/venta/${project.slug}/publish`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "No se pudo publicar." });
    setStatus("published");
    router.refresh();
    setMsg({ kind: "ok", text: `Publicado en ${data.url}` });
  }

  async function uploadShot(field: "instagram" | "tiktok" | "busqueda", file: File) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("field", field);
    const res = await fetch(`/api/venta/${project.slug}/upload`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ kind: "error", text: data.error || "No se pudo subir." });

    if (field === "instagram") patch({ instagram: { ...research.instagram, screenshot: data.url } });
    if (field === "tiktok") patch({ tiktok: { ...research.tiktok, screenshot: data.url } });
    if (field === "busqueda") {
      patch({ search: { query: research.search?.query || project.brand, results: research.search?.results ?? [], screenshot: data.url } });
    }
    refreshPreview();
    setMsg({ kind: "ok", text: "Imagen subida." });
  }

  const publicUrl = `${publicBase}/r/${project.slug}`;
  const src = research.sources ?? {};

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8">
      {/* ── Barra de acciones ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1">Llamada de venta</div>
          <h1 className="truncate text-2xl font-bold tracking-tight">{project.brand}</h1>
          <div className="mt-1 text-xs text-fg-faint">
            {status === "published" ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="text-iris underline">
                {publicUrl}
              </a>
            ) : (
              <>Sin publicar · el link será {publicUrl}</>
            )}
            {engineLabel && <> · copy por {engineLabel}</>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => scrape()} disabled={busy !== null}>
            {busy === "scrape" ? "Buscando…" : "Buscar datos"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={writeCopy} disabled={busy !== null}>
            {busy === "copy" ? "Escribiendo…" : "Escribir copy"}
          </button>
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ── Formulario ── */}
        <div className="space-y-4">
          <Section title="La marca" defaultOpen>
            <Text label="Página web" value={research.site} onChange={(v) => patch({ site: v })} placeholder="https://…" />
            <Area
              label="Qué venden"
              rows={2}
              value={research.industry}
              onChange={(v) => patch({ industry: v })}
              placeholder="ropa deportiva premium para running, DTC en México ($749-$1,299)"
            />
            <Area
              label="Notas para el copy"
              rows={3}
              value={research.notes}
              onChange={(v) => patch({ notes: v })}
              placeholder="Lo que sepas y no salga de las APIs: contexto de la llamada, quién es el decisor, qué ya intentaron…"
            />
          </Section>

          <Section title="Paid Media" subtitle="Ad Library de Meta · México" badge={<SourceBadge state={src.ads} />}>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="label">Anuncios activos</span>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={research.adCount ?? 0}
                  onChange={(e) => patch({ adCount: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <span className="label">Imagen</span>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={research.adImageCount ?? 0}
                  onChange={(e) => patch({ adImageCount: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <span className="label">Video</span>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={research.adVideoCount ?? 0}
                  onChange={(e) => patch({ adVideoCount: Number(e.target.value) })}
                />
              </label>
            </div>
            <Text label="Formato que predomina" value={research.adFormat} onChange={(v) => patch({ adFormat: v })} placeholder="mezcla: estático dominante + video de marca" />
            <Text label="Anuncio más viejo" value={research.adOldest} onChange={(v) => patch({ adOldest: v })} placeholder="19 jul 2026" />
            <Area label="Hooks que está usando" rows={2} value={research.adHooks} onChange={(v) => patch({ adHooks: v })} />

            {(research.ads ?? []).length > 0 && (
              <div>
                <span className="label">Creativos que se van a mostrar</span>
                <div className="grid grid-cols-4 gap-3">
                  {research.ads!.map((ad, i) => (
                    <figure key={i} className="overflow-hidden rounded-lg border border-line bg-surface-2">
                      {ad.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.image} alt="" className="h-24 w-full object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center text-[10px] text-fg-faint">Sin creativo</div>
                      )}
                      <figcaption className="line-clamp-2 p-2 text-[10px] leading-tight text-fg-muted">{ad.text}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            {research.adLibraryUrl && (
              <a href={research.adLibraryUrl} target="_blank" rel="noreferrer" className="block text-sm text-iris underline">
                Abrir la Ad Library de esta marca ↗
              </a>
            )}

            <AdvertiserPicker
              brand={project.brand}
              currentPageId={research.adPageId}
              disabled={busy !== null}
              onPick={(pageId) => {
                patch({ adPageId: pageId });
                void scrape(pageId);
              }}
            />
          </Section>

          <ProfileSection
            title="Instagram"
            network="instagram"
            profile={research.instagram}
            state={src.instagram}
            onChange={(p) => patch({ instagram: { ...research.instagram, ...p } })}
            onUpload={(f) => uploadShot("instagram", f)}
          />

          <ProfileSection
            title="TikTok"
            network="tiktok"
            profile={research.tiktok}
            state={src.tiktok}
            onChange={(p) => patch({ tiktok: { ...research.tiktok, ...p } })}
            onUpload={(f) => uploadShot("tiktok", f)}
          />

          <Section title="Videos y creadores" subtitle="Lo que sale al buscar la marca en TikTok" badge={<SourceBadge state={src.busqueda} />}>
            <Text
              label="Qué se buscó"
              value={research.search?.query}
              onChange={(v) => patch({ search: { query: v, results: research.search?.results ?? [], screenshot: research.search?.screenshot } })}
            />

            {(research.search?.results ?? []).length > 0 && (
              <div>
                <span className="label">Resultados del buscador</span>
                <div className="grid grid-cols-6 gap-2">
                  {research.search!.results.map((c, i) => (
                    <figure key={i} className="overflow-hidden rounded-lg border border-line bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {c.image && <img src={c.image} alt="" className="h-20 w-full object-cover" />}
                      <figcaption className="p-1 text-center text-[10px] font-semibold">{c.views}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            <Upload
              label="O sube la captura real del buscador"
              current={research.search?.screenshot}
              onFile={(f) => uploadShot("busqueda", f)}
            />

            <ClipList
              label="Mejores 2 videos propios"
              clips={research.organic?.brand ?? []}
              onChange={(brand) => patch({ organic: { brand, creators: research.organic?.creators ?? [] } })}
            />
            <ClipList
              label="Mejores 2 videos de creadores externos"
              clips={research.organic?.creators ?? []}
              onChange={(creators) => patch({ organic: { brand: research.organic?.brand ?? [], creators } })}
            />

            <label className="block">
              <span className="label">¿Qué contenido rinde mejor?</span>
              <select
                className="field"
                value={research.bestContent}
                onChange={(e) => patch({ bestContent: e.target.value as Research["bestContent"] })}
              >
                <option value="creador">Un creador externo — el cierre más fuerte</option>
                <option value="marca">La marca misma</option>
                <option value="nodata">Todavía no hay data suficiente</option>
              </select>
            </label>
          </Section>

          <DeckSection deck={deck} onChange={setDeck} />

          <DangerZone
            slug={project.slug}
            kind="venta"
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
            src={`/api/venta/${project.slug}/preview`}
            title="Preview de la presentación"
            className="aspect-video w-full rounded-xl border border-line bg-[#1A1A1A]"
          />
          <p className="mt-2 text-xs text-fg-faint">
            Guarda para que el preview tome tus cambios. Dentro del deck te mueves con las flechas o haciendo click.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────────────── */

function ProfileSection({
  title,
  network,
  profile,
  state,
  onChange,
  onUpload,
}: {
  title: string;
  network: "instagram" | "tiktok";
  profile: Research["instagram"];
  state?: "ok" | "fallo" | "manual";
  onChange: (p: Partial<NonNullable<Research["instagram"]>>) => void;
  onUpload: (f: File) => void;
}) {
  return (
    <Section title={title} subtitle="Perfil que se muestra en la slide 2" badge={<SourceBadge state={state} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Handle" value={profile?.handle} onChange={(v) => onChange({ handle: v })} placeholder={network === "tiktok" ? "rslnt_mx" : "resilient.mx"} />
        <Text label="Nombre que se ve" value={profile?.name} onChange={(v) => onChange({ name: v })} />
        <Text label="Seguidores" value={profile?.followers} onChange={(v) => onChange({ followers: v })} placeholder="9,795" />
        <Text label="Publicaciones" value={profile?.posts} onChange={(v) => onChange({ posts: v })} placeholder="184" />
      </div>
      <Area label="Bio" rows={2} value={profile?.bio} onChange={(v) => onChange({ bio: v })} />
      <Upload
        label="O sube la captura real del perfil (reemplaza la tarjeta)"
        current={profile?.screenshot}
        onFile={onUpload}
        onClear={() => onChange({ screenshot: null })}
      />
    </Section>
  );
}

function ClipList({
  label,
  clips,
  onChange,
}: {
  label: string;
  clips: NonNullable<Research["organic"]>["brand"];
  onChange: (c: NonNullable<Research["organic"]>["brand"]) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="space-y-3">
        {clips.length === 0 && <p className="text-xs text-fg-faint">Nada todavía. Corre “Buscar datos”.</p>}
        {clips.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.image ? <img src={c.image} alt="" className="h-16 w-12 rounded object-cover" /> : <div className="h-16 w-12 rounded bg-surface" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                className="field py-1 text-xs"
                placeholder="views"
                value={c.views ?? ""}
                onChange={(e) => onChange(clips.map((x, j) => (j === i ? { ...x, views: e.target.value } : x)))}
              />
              <input
                className="field py-1 text-xs"
                placeholder="descripción"
                value={c.title ?? ""}
                onChange={(e) => onChange(clips.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
            </div>
            <button type="button" onClick={() => onChange(clips.filter((_, j) => j !== i))} className="shrink-0 text-xs text-danger hover:underline">
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Upload({
  label,
  current,
  onFile,
  onClear,
}: {
  label: string;
  current?: string | null;
  onFile: (f: File) => void;
  onClear?: () => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {current && (
        <div className="mb-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt="" className="h-20 rounded-lg border border-line object-cover" />
          {onClear && (
            <button type="button" onClick={onClear} className="text-xs text-danger hover:underline">
              Quitar captura
            </button>
          )}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="block w-full text-xs text-fg-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function DeckSection({ deck, onChange }: { deck: Deck | null; onChange: (d: Deck) => void }) {
  if (!deck) {
    return (
      <Section title="Copy de las slides" subtitle="Todavía no se genera" defaultOpen>
        <p className="text-sm text-fg-muted">
          Cuando el research esté correcto, dale a <b>Escribir copy</b> arriba. Después puedes ajustar cada texto aquí.
        </p>
      </Section>
    );
  }

  const set = (fn: (d: Deck) => Deck) => onChange(fn(deck));

  return (
    <Section title="Copy de las slides" subtitle="Lo que escribió Claude, editable" defaultOpen>
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-faint">Slide 1 · Paid Media</p>
        <Area
          label="Subtítulo"
          max={LIMITS.subtitle}
          value={deck.s1.subtitle}
          onChange={(v) => set((d) => ({ ...d, s1: { ...d.s1, subtitle: v } }))}
        />
        {deck.s1.cards.map((c, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
            <Area
              label={`Idea ${i + 1} · título`}
              rows={1}
              max={LIMITS.cardTitle}
              value={c.title}
              onChange={(v) => set((d) => ({ ...d, s1: { ...d.s1, cards: d.s1.cards.map((x, j) => (j === i ? { ...x, title: v } : x)) } }))}
            />
            <Area
              label={`Idea ${i + 1} · descripción`}
              max={LIMITS.cardDesc}
              value={c.desc}
              onChange={(v) => set((d) => ({ ...d, s1: { ...d.s1, cards: d.s1.cards.map((x, j) => (j === i ? { ...x, desc: v } : x)) } }))}
            />
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-faint">Slide 2 · Orgánico</p>
        <Area label="Subtítulo" max={LIMITS.subtitle} value={deck.s2.subtitle} onChange={(v) => set((d) => ({ ...d, s2: { ...d.s2, subtitle: v } }))} />
        <Area
          label="Hallazgo · título"
          rows={1}
          max={LIMITS.insightTitle}
          value={deck.s2.insight.title}
          onChange={(v) => set((d) => ({ ...d, s2: { ...d.s2, insight: { ...d.s2.insight, title: v } } }))}
        />
        <Area
          label="Hallazgo · texto"
          max={LIMITS.insightDesc}
          value={deck.s2.insight.desc}
          onChange={(v) => set((d) => ({ ...d, s2: { ...d.s2, insight: { ...d.s2.insight, desc: v } } }))}
        />
      </div>

      <div className="space-y-4 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-faint">Slide 3 · Creadores</p>
        <Area label="Subtítulo" max={LIMITS.subtitle} value={deck.s3.subtitle} onChange={(v) => set((d) => ({ ...d, s3: { ...d.s3, subtitle: v } }))} />

        {(["win", "own"] as const).map((key) => (
          <div key={key} className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xs font-semibold text-fg-muted">{key === "win" ? "Tarjeta destacada" : "Tarjeta de la marca"}</p>
            <Area label="Etiqueta" rows={1} max={LIMITS.compLabel} value={deck.s3[key].label} onChange={(v) => set((d) => ({ ...d, s3: { ...d.s3, [key]: { ...d.s3[key], label: v } } }))} />
            <Area label="Título" rows={1} max={LIMITS.compTitle} value={deck.s3[key].title} onChange={(v) => set((d) => ({ ...d, s3: { ...d.s3, [key]: { ...d.s3[key], title: v } } }))} />
            <Area label="Descripción" max={LIMITS.compDesc} value={deck.s3[key].desc} onChange={(v) => set((d) => ({ ...d, s3: { ...d.s3, [key]: { ...d.s3[key], desc: v } } }))} />
          </div>
        ))}

        <Area label="Cierre · título" rows={1} max={LIMITS.closingTitle} value={deck.s3.closing.title} onChange={(v) => set((d) => ({ ...d, s3: { ...d.s3, closing: { ...d.s3.closing, title: v } } }))} />
        <Area label="Cierre · texto" max={LIMITS.closingText} value={deck.s3.closing.text} onChange={(v) => set((d) => ({ ...d, s3: { ...d.s3, closing: { ...d.s3.closing, text: v } } }))} />
      </div>
    </Section>
  );
}
