import type { Metadata } from "next";
import { Onboarding } from "@/modules/site/Onboarding";

export const metadata: Metadata = { title: "Criar conta" };

export default function Page() {
  return <Onboarding />;
}
