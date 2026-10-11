import type { Metadata } from "next";
import { Integrations } from "@/modules/client/Integrations";

export const metadata: Metadata = { title: "Integrações" };

export default function Page() {
  return <Integrations />;
}
