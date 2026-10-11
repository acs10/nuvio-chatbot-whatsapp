import { DM_Sans, Manrope } from "next/font/google";

// Mesmas fontes do design (Figma Make), servidas pelo próprio site.
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans" });
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope" });

export const fontVariables = `${dmSans.variable} ${manrope.variable}`;
