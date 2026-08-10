"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  created_at: string;
};

export default function TeamManager({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/equipo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "No se pudo guardar.");
    setOk(`${form.email} ya puede entrar.`);
    setForm({ name: "", email: "", password: "", role: "member" });
    router.refresh();
  }

  async function remove(m: TeamMember) {
    if (!confirm(`¿Quitar el acceso de ${m.name}? Las presentaciones que creó se quedan.`)) return;
    setBusy(true);
    const res = await fetch("/api/equipo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error || "No se pudo borrar.");
    }
    router.refresh();
  }

  return (
    <>
      <form onSubmit={add} className="card mt-8 p-6">
        <h2 className="font-bold">Dar de alta</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="t-name">
              Nombre
            </label>
            <input
              id="t-name"
              required
              className="field"
              placeholder="Henry Pérez"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-email">
              Correo
            </label>
            <input
              id="t-email"
              type="email"
              required
              className="field"
              placeholder="henry@hubb.mx"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-pass">
              Contraseña (mínimo 8)
            </label>
            <input
              id="t-pass"
              required
              minLength={8}
              className="field"
              placeholder="la que le vas a pasar"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="t-role">
              Rol
            </label>
            <select
              id="t-role"
              className="field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="member">Miembro — crea y publica</option>
              <option value="admin">Admin — además maneja el equipo</option>
            </select>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {ok && <p className="mt-4 text-sm text-[var(--color-ok)]">{ok}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary mt-5">
          {busy ? "Guardando…" : "Dar de alta"}
        </button>
      </form>

      <div className="card mt-8 divide-y divide-[var(--color-line)]">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="truncate font-semibold">
                {m.name}
                {m.id === currentUserId && <span className="ml-2 text-xs font-normal text-fg-faint">(tú)</span>}
              </div>
              <div className="truncate text-sm text-fg-muted">{m.email}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-fg-muted">
                {m.role === "admin" ? "Admin" : "Miembro"}
              </span>
              {m.id !== currentUserId && (
                <button type="button" disabled={busy} onClick={() => remove(m)} className="text-sm text-danger hover:underline disabled:opacity-50">
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
