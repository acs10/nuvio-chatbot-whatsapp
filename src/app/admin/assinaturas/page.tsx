import type { Metadata } from "next";
import { AdminSubscriptions } from "@/modules/admin/AdminPages";

export const metadata: Metadata = { title: "Assinaturas" };

export default function Page() {
  return <AdminSubscriptions />;
}
