import type { Metadata } from "next";
import { LegalPage } from "@/modules/site/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function Page() {
  return <LegalPage kind="termos" />;
}
