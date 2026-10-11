import type { Metadata } from "next";
import { AdminSettings } from "@/modules/admin/AdminPages";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return <AdminSettings />;
}
