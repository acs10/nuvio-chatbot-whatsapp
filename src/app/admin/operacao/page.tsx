import type { Metadata } from "next";
import { AdminOperation } from "@/modules/admin/AdminPages";

export const metadata: Metadata = { title: "Operação" };

export default function Page() {
  return <AdminOperation />;
}
