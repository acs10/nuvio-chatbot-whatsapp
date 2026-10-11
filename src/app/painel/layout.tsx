import type { ReactNode } from "react";
import { AppShell } from "@/modules/shell/AppShell";

export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell role="client">{children}</AppShell>;
}
