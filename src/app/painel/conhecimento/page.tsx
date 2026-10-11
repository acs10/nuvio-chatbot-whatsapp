import type { Metadata } from "next";
import { Knowledge } from "@/modules/client/Knowledge";

export const metadata: Metadata = { title: "Base de conhecimento" };

export default function Page() {
  return <Knowledge />;
}
