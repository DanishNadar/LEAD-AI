import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4, Source_Code_Pro } from "next/font/google";
import "./globals.css";

// Illinois Tech's official typefaces. See iit.edu/marketing-communications/resources/fonts-and-typography.
const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const mono = Source_Code_Pro({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "LEAD-AI | Leadership Academy",
  description: "Evidence-led reporting for leadership education.",
};

export const viewport: Viewport = {
  themeColor: "#cc0000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
