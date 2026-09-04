"use client";

import { useState, type ChangeEvent } from "react";
import { Input, Select, Button, cx } from "@/components/ui";
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

export function ScanForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
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
    setUnconfigured(false);
    try {
      const base64 = preview.split(",")[1];
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type, extraContext }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) setUnconfigured(true);
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
    <div className="flex flex-col gap-4">
      <div className="rounded-ui-lg border border-dashed border-line p-4">
        <input type="file" accept="image/*" onChange={handleFile} className="text-meta text-ink-muted" />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Vista previa del recibo"
            className="mt-3 max-h-64 rounded-ui border border-line"
          />
        )}
        <Button type="button" disabled={!file || loading} onClick={() => analyze()} className="mt-3">
          {loading ? "Analizando…" : "Analizar recibo"}
        </Button>
        {error && (
          <p className={cx("mt-2 text-sm", unconfigured ? "text-accent-warm" : "text-danger")}>
            {error}
          </p>
        )}
      </div>

      {result?.pregunta && (
        <div className="rounded-ui-lg border border-accent-warm/40 bg-accent-warm/[0.05] p-3 text-sm">
          <p className="text-ink">{result.pregunta}</p>
          <div className="mt-2 flex gap-2">
            <Input
              value={clarification}
              onChange={(e) => setClarification(e.target.value)}
              placeholder="Tu respuesta"
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={() => analyze(clarification)}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {result && (
        <form action={registerScan} className="flex flex-col gap-2 rounded-ui-lg border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                result.tipo === "factura_recurrente"
                  ? "border-accent/28 bg-accent/12 text-accent-text"
                  : "border-accent-warm/28 bg-accent-warm/12 text-accent-warm",
              )}
            >
              {result.tipo === "factura_recurrente" ? "🔄 Factura recurrente" : "💸 Gasto puntual"}
            </span>
            <span className="text-meta text-ink-dim">Confianza: {result.confianza}</span>
          </div>

          <input type="hidden" name="tipo" value={result.tipo} />

          <Input name="descripcion" defaultValue={result.descripcion} placeholder="Descripción" className="w-full" />

          <div className="flex gap-2">
            <Input type="number" step="0.01" name="monto" defaultValue={result.monto} required className="flex-1" />
            <Input type="date" name="fecha" defaultValue={result.fecha} required className="flex-1" />
          </div>

          <div className="flex gap-2">
            <Select name="categoria" defaultValue={result.categoria} className="flex-1">
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select name="accountId" className="flex-1">
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>

          {result.tipo === "factura_recurrente" && (
            <Input
              type="number"
              name="dueDay"
              min={1}
              max={28}
              placeholder="Día de vencimiento mensual (1-28)"
              defaultValue={Number(result.fecha.slice(8, 10))}
              className="w-full"
            />
          )}

          <Button type="submit" className="w-full">
            Registrar
          </Button>
        </form>
      )}
    </div>
  );
}
