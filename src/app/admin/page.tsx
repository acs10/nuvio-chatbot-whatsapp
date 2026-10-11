import type { Metadata } from "next";
import { AdminOverview } from "@/modules/admin/AdminPages";

export const metadata: Metadata = { title: "Backoffice" };

export default function Page() {
  return <AdminOverview />;
}
