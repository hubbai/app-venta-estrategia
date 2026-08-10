"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }
      // replace + refresh: el middleware vuelve a evaluar con la cookie nueva
      // y no queda el login en el historial.
      router.replace(next);
      router.refresh();
    } catch {
      setError("Sin conexión con el servidor.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm p-8">
      <div className="eyebrow mb-2">HUBB · Full Service</div>
      <h1 className="text-2xl font-bold tracking-tight">
        Entra a <span className="hl">tu cuenta</span>
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        Presentaciones de llamada y estrategias. Si no tienes acceso, pídeselo a un admin del equipo.
      </p>

      <div className="mt-7 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            className="field"
            placeholder="tu@hubb.mx"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full">
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
