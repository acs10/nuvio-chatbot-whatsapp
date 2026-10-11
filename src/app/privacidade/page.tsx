import type { Metadata } from "next";
import { LegalPage } from "@/modules/site/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function Page() {
  return <LegalPage kind="privacidade" />;
}
