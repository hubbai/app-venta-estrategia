"use client";

/* Primitivas del editor. Los dos módulos (venta y estrategia) son formularios
   largos; sin esto se repetirían las mismas 10 líneas por campo. */

import { useState } from "react";

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="mt-1.5 block text-xs text-fg-faint">{hint}</span>}
    </label>
  );
}

export function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  max,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  max?: number;
}) {
  const len = (value ?? "").length;
  const over = max != null && len > max;
  return (
    <label className="block">
      <span className="label flex items-center justify-between">
        {label}
        {max != null && (
          <span className={over ? "font-normal text-danger" : "font-normal text-fg-faint"}>
            {len}/{max}
          </span>
        )}
      </span>
      <textarea
        className="field resize-y"
        rows={rows}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {over && <span className="mt-1.5 block text-xs text-danger">Se va a cortar en la slide.</span>}
    </label>
  );
}

export function Section({
  title,
  subtitle,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            {title}
            {badge}
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-fg-faint">{subtitle}</div>}
        </div>
        <span className={`shrink-0 text-fg-faint transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && <div className="space-y-4 border-t border-line px-5 py-5">{children}</div>}
    </section>
  );
}

/* Semáforo de qué se trajo solo y qué no. */
export function SourceBadge({ state }: { state?: "ok" | "fallo" | "manual" }) {
  if (!state) return null;
  const map = {
    ok: { text: "Automático", cls: "bg-[color-mix(in_srgb,var(--color-ok)_16%,transparent)] text-[var(--color-ok)]" },
    fallo: { text: "No se pudo", cls: "bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-danger" },
    manual: { text: "A mano", cls: "bg-surface-2 text-fg-muted" },
  }[state];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map.cls}`}>{map.text}</span>;
}
