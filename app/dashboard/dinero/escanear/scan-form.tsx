"use client";

import { useState, type ChangeEvent } from "react";
import { registerScan } from "./actions";

type ScanResult = {
  tipo: string;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: string;
  confianza: string;
  pregunta: string | null;
};

const CATEGORIAS = [
  "servicios",
  "mercado",
  "salud",
  "tecnologia",
  "hogar",
  "restaurantes",
  "transporte",
  "herramientas",
  "otros",
];

export function ScanForm({
  accounts,
}: {
  accounts: { id: string; name: string }[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [clarification, setClarification] = useState("");

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    if (!f) {
      setPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function analyze(extraContext?: string) {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = preview.split(",")[1];
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type, extraContext }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al analizar la imagen");
        return;
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed border-border p-4">
        <input type="file" accept="image/*" onChange={handleFile} className="text-sm text-text-muted" />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Vista previa del recibo"
            className="mt-3 max-h-64 rounded-md border border-border"
          />
        )}
        <button
          type="button"
          disabled={!file || loading}
          onClick={() => analyze()}
          className="mt-3 rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple disabled:opacity-50"
        >
          {loading ? "Analizando…" : "Analizar recibo"}
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {result?.pregunta && (
        <div className="rounded-md border border-gold/40 bg-gold/5 p-3 text-sm">
          <p className="text-text-primary">{result.pregunta}</p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={clarification}
              onChange={(e) => setClarification(e.target.value)}
              placeholder="Tu respuesta"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => analyze(clarification)}
              className="rounded-sm border border-border px-3 py-1.5 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {result && (
        <form
          action={registerScan}
          className="space-y-2 rounded-md border border-border bg-bg-card p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                result.tipo === "factura_recurrente"
                  ? "bg-purple-mid/10 text-purple-light"
                  : "bg-gold/10 text-gold"
              }`}
            >
              {result.tipo === "factura_recurrente" ? "🔄 Factura recurrente" : "💸 Gasto puntual"}
            </span>
            <span className="text-xs text-text-muted">
              Confianza: {result.confianza}
            </span>
          </div>

          <input type="hidden" name="tipo" value={result.tipo} />

          <input
            type="text"
            name="descripcion"
            defaultValue={result.descripcion}
            placeholder="Descripción"
            className="input w-full"
          />

          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              name="monto"
              defaultValue={result.monto}
              required
              className="input flex-1"
            />
            <input
              type="date"
              name="fecha"
              defaultValue={result.fecha}
              required
              className="input flex-1"
            />
          </div>

          <div className="flex gap-2">
            <select name="categoria" defaultValue={result.categoria} className="input flex-1">
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="accountId" className="input flex-1">
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {result.tipo === "factura_recurrente" && (
            <input
              type="number"
              name="dueDay"
              min={1}
              max={28}
              placeholder="Día de vencimiento mensual (1-28)"
              defaultValue={Number(result.fecha.slice(8, 10))}
              className="input w-full"
            />
          )}

          <button
            type="submit"
            className="w-full rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
          >
            Registrar
          </button>
        </form>
      )}
    </div>
  );
}
