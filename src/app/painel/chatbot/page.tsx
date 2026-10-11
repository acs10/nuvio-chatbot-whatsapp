import type { Metadata } from "next";
import { Assistant } from "@/modules/client/Assistant";

export const metadata: Metadata = { title: "Meu chatbot" };

export default function Page() {
  return <Assistant />;
}
