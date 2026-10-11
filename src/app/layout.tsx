import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "@/core/theme/fonts";
import { PlatformProvider } from "@/modules/platform/PlatformProvider";
import { getInitialState } from "@/modules/server/initial-state";
import "./globals.css";
import "./complementos.css";

export const metadata: Metadata = {
  title: { default: "Nuvio — atendimento inteligente no WhatsApp", template: "%s | Nuvio" },
  description: "Transforme seu WhatsApp em um canal de atendimento com IA, treinado com o conhecimento da sua empresa e disponível o tempo todo.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initial = await getInitialState();
  return (
    <html lang="pt-BR" className={fontVariables}>
      <body>
        <PlatformProvider initial={initial}>{children}</PlatformProvider>
      </body>
    </html>
  );
}
