// Librería del sistema visual nuevo (rebranding). Turno 4b + estados de
// formulario del 5b. Todo con los tokens nuevos (canvas/surface/line/ink/
// accent + rounded-ui + .focus-ring). Ver el documento de diseño "Sistema
// IArcanIA".
//
// Este barril re-exporta SOLO piezas server-safe. Las piezas con estado
// cliente se importan de su propio archivo para no arrastrar su runtime a
// las páginas que no las usan (el sistema es server-first: 5e):
//   import { Form, FormField, FormActions, FormBanner } from "@/components/ui/form";
//   import { Modal } from "@/components/ui/modal";
//   import { ConfirmDialog } from "@/components/ui/confirm-dialog";
//   import { ToastProvider, useToast } from "@/components/ui/toast";
//   import { SubNav } from "@/components/ui/sub-nav";
//
// Para formularios: <Labeled> (etiqueta + control apilados, aquí en
// ./inputs) para `<form action={serverAction}>` planos, o <FormField> de
// ./form cuando hace falta estado de validación. El viejo <Field>
// (components/ui/field.tsx) se borró al terminar la migración.

export { cx } from "./cx";
export { catInfo } from "./category";

export { PageHeader } from "./page-header";
export { Section } from "./section";
export { Button } from "./button";
export { Card } from "./card";
export { Table, TableHead, TableRow } from "./table";
export { ItemList, ItemRow } from "./item-list";
export { Chip, Badge, CategoryDot, CategoryTag } from "./chip";
export { Input, Select, Textarea, Labeled } from "./inputs";
export { Segmented, Stepper } from "./segmented";
export { Progress, MetricCard } from "./progress";
export { EmptyState, Skeleton } from "./states";
export { NoResults } from "./no-results";
export { Pagination } from "./pagination";
export { QuickCapture } from "./quick-capture";

// Contrato de Server Action para <Form> — módulo sin "use client", seguro de
// importar desde acciones ("use server").
export type { FormResult } from "./form-result";
export { formOk, formErrors } from "./form-result";
