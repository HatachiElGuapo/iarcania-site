export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-text-primary">Curso</h1>
      <p className="mt-2 text-text-muted">
        ID: {id} — pendiente de migrar desde os.js.
      </p>
    </div>
  );
}
