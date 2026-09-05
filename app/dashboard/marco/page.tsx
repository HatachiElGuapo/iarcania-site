import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { marcoDocuments } from "@/lib/db/schema/marco";
import { PageHeader, EmptyState, Labeled, Input, Textarea, Button, cx } from "@/components/ui";
import { Marked } from "./marked";
import { PrintButton } from "./print-button";
import { updateMarcoDocument } from "./actions";

function fmtUpdated(d: Date) {
  return d.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function MarcoPage() {
  const session = await auth();
  const userId = session!.user.id;

  const docs = await db
    .select()
    .from(marcoDocuments)
    .where(eq(marcoDocuments.userId, userId))
    .orderBy(asc(marcoDocuments.sortOrder));

  return (
    <div className="p-8 print:p-0">
      <PageHeader
        icon="📜"
        title="Marco"
        subtitle="Tus documentos de referencia — para leer y para imprimir"
        actions={<PrintButton />}
      />

      {docs.length === 0 ? (
        <EmptyState icon="📜">Todavía no has escrito ningún documento de Marco.</EmptyState>
      ) : (
        <div className="flex flex-col gap-10 print:gap-0">
          {docs.map((doc, i) => (
            <article
              key={doc.id}
              className={cx(
                "flex flex-col gap-4 print:break-inside-avoid print:px-10 print:py-8",
                i < docs.length - 1 && "print:break-after-page",
              )}
            >
              <div>
                <h1 className="font-display text-2xl font-bold text-ink print:text-3xl">
                  {doc.title}
                </h1>
                <p className="mt-1 text-meta text-ink-dim print:hidden">
                  Actualizado {fmtUpdated(doc.updatedAt)}
                </p>
              </div>

              <div className="text-lg leading-relaxed text-ink print:text-xl print:leading-loose">
                {doc.format === "lista" ? (
                  <>
                    {doc.intro && (
                      <p className="mb-3">
                        <Marked text={doc.intro} />
                      </p>
                    )}
                    <ul className="flex list-disc flex-col gap-2 pl-5">
                      {doc.content
                        .split("\n")
                        .map((line, li) =>
                          line.trim() ? (
                            <li key={li}>
                              <Marked text={line} />
                            </li>
                          ) : null,
                        )}
                    </ul>
                  </>
                ) : (
                  <p>
                    <Marked text={doc.content} />
                  </p>
                )}
              </div>

              <details className="print:hidden">
                <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
                  Editar
                </summary>
                <form
                  action={updateMarcoDocument}
                  className="mt-2 flex flex-col gap-3 rounded-ui-lg border border-dashed border-line p-4"
                >
                  <input type="hidden" name="id" value={doc.id} />
                  {doc.format === "lista" && (
                    <Labeled label="Intro (opcional)">
                      <Input name="intro" defaultValue={doc.intro ?? ""} className="w-full" />
                    </Labeled>
                  )}
                  <Labeled label={doc.format === "lista" ? "Un ítem por línea" : "Texto"}>
                    <Textarea
                      name="content"
                      defaultValue={doc.content}
                      rows={doc.format === "lista" ? 12 : 6}
                      className="w-full font-mono text-sm"
                    />
                  </Labeled>
                  <Button type="submit" variant="secondary" className="w-fit">
                    Guardar
                  </Button>
                </form>
              </details>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
