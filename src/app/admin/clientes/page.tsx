import type { Metadata } from "next";
import { AdminClients } from "@/modules/admin/AdminPages";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return <AdminClients />;
}
