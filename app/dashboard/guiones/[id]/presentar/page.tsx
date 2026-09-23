import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts, scriptSlides } from "@/lib/db/schema/guiones";
import { brandThemeForCanal } from "@/lib/guiones/brands";
import { Presenter } from "./presenter";

export default async function PresentarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const [script] = await db
    .select()
    .from(scripts)
    .where(and(eq(scripts.id, id), eq(scripts.userId, userId)))
    .limit(1);
  if (!script) notFound();

  const slides = await db
    .select()
    .from(scriptSlides)
    .where(eq(scriptSlides.scriptId, id))
    .orderBy(asc(scriptSlides.orden));

  const theme = await brandThemeForCanal(script.canal);

  if (slides.length === 0) {
    return (
      <div className="p-8">
        <p className="text-body text-ink-muted">
          Este guión todavía no tiene slides.{" "}
          <Link href="/dashboard/guiones" className="text-accent focus-ring">
            Volver a Guiones
          </Link>{" "}
          y usar “✨ Generar slides”.
        </p>
      </div>
    );
  }

  return <Presenter title={script.title} slides={slides} theme={theme} />;
}
