import { redirect } from "next/navigation";

export default function DineroIndexPage() {
  redirect("/dashboard/dinero/cuentas");
}
