"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Única pantalla del sistema nuevo que ve alguien que no sea el dueño. Es
// también el único lugar donde el borde y el foco son violeta (accent): en
// el resto de la app el violeta se reserva para la acción primaria. Sin
// blobs ni glow — plano, como el resto del sistema.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Correo o contraseña incorrectos");
      return;
    }

    router.push("/dashboard");
  }

  const fieldCls =
    "focus-ring w-full rounded-ui-lg border border-accent/20 bg-surface-2 px-3.5 py-3 text-sm " +
    "text-ink outline-none transition-colors duration-120 placeholder:text-ink-dim focus:border-accent/50";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] rounded-ui-lg border border-accent/15 bg-surface px-8 py-9"
      >
        <div className="mb-6 text-center font-display text-[22px] font-bold tracking-[0.05em] text-accent-warm">
          IArcanIA OS
        </div>
        <h2 className="mb-6 text-[22px] text-ink">Acceso</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[1px] text-ink-muted">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="tu@email.com"
            className={fieldCls}
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[1px] text-ink-muted">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={fieldCls}
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-1.5 w-full rounded-ui-lg py-[13px] text-[15px]"
        >
          {loading ? "Entrando…" : "Entrar"}
        </Button>

        {error && (
          <div className="mt-3 rounded-ui border border-danger/25 bg-danger/[0.08] px-3.5 py-2.5 text-center text-sm text-danger">
            {error}
          </div>
        )}
      </form>
    </main>
  );
}
