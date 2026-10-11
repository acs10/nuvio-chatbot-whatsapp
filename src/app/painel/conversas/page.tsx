import type { Metadata } from "next";
import { Suspense } from "react";
import { Conversations } from "@/modules/client/Conversations";

export const metadata: Metadata = { title: "Conversas" };

export default function Page() {
  return <Suspense><Conversations /></Suspense>;
}
