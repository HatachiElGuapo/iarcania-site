import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { financialAccounts } from "@/lib/db/schema/dinero";
import { ScanForm } from "./scan-form";

export default async function EscanearPage() {
  const session = await auth();
  const userId = session!.user.id;

  const userAccounts = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true)))
    .orderBy(asc(financialAccounts.name));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-meta text-ink-muted">
        Sube o toma foto de una factura o recibo — la IA extrae los datos y los pre-llena para que
        confirmes antes de registrar el gasto.
      </p>
      <ScanForm accounts={userAccounts} />
    </div>
  );
}
