import type { Metadata } from "next";
import { ClientOverview } from "@/modules/client/Overview";

export const metadata: Metadata = { title: "Visão geral" };

export default function Page() {
  return <ClientOverview />;
}
