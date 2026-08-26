"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Ver os.css #auth-screen/.auth-card/.auth-logo/.field/.btn-primary — el
// único lugar de la app real donde el borde y el foco son morados (todo lo
// demás usa el gris plano de --border). No agregar blobs/glow: el original
// no los tiene aquí tampoco.
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-deep p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] rounded-lg border border-purple-mid/[0.15] bg-[#111120] px-8 py-9"
      >
        <div className="mb-6 text-center font-display text-[22px] tracking-[0.05em] text-gold">
          IArcanIA OS
        </div>
        <h2 className="mb-6 text-[22px] text-text-primary">Acceso</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[1px] text-[#8a86b0]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="tu@email.com"
            className="w-full rounded-[10px] border border-purple-mid/[0.18] bg-white/[0.04] px-3.5 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-[#4a4860] focus:border-purple-mid/50"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[1px] text-[#8a86b0]">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-[10px] border border-purple-mid/[0.18] bg-white/[0.04] px-3.5 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-[#4a4860] focus:border-purple-mid/50"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1.5 w-full rounded-[10px] bg-purple-mid py-[13px] text-[15px] font-medium text-white transition-[background,transform] hover:-translate-y-px hover:bg-purple-light disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        {error && (
          <div className="mt-3 rounded-md border border-red-400/25 bg-red-400/[0.08] px-3.5 py-2.5 text-center text-sm text-red-400">
            {error}
          </div>
        )}
      </form>
    </main>
  );
}
