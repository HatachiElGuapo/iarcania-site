// Decoración de fondo — ver preview/brand-blobs.html. Blob morado + blob
// dorado con blur y animación float, más grid sutil opcional. Puramente
// decorativo (pointer-events-none), pensado para vivir detrás del
// contenido real vía position:absolute en un contenedor `relative`.
export function Blobs({ grid = false }: { grid?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-16 -top-20 h-64 w-64 animate-float1 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-12 -right-10 h-44 w-44 animate-float2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
        }}
      />
      {grid && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}
    </div>
  );
}
