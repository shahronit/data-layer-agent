import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { APP_DESCRIPTION, APP_TITLE } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-dvh overflow-hidden bg-[#06060a] text-slate-100 noise">{children}</body>
    </html>
  );
}
