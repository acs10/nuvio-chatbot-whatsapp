import type { Metadata } from "next";
import { Billing } from "@/modules/client/Billing";

export const metadata: Metadata = { title: "Plano e cobrança" };

export default function Page() {
  return <Billing />;
}
