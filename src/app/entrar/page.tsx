import type { Metadata } from "next";
import { LoginPage } from "@/modules/site/LoginPage";

export const metadata: Metadata = { title: "Entrar" };

export default function Page() {
  return <LoginPage />;
}
