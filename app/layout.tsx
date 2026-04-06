import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/app/providers";
import { LayoutClient } from "@/app/layout-client";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "GTS Academy Admin",
  description: "Production-grade admin portal for academy operations and learner readiness.",
  icons: {
    icon: "/api/branding/favicon",
    shortcut: "/api/branding/favicon",
    apple: "/api/branding/favicon",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <LayoutClient>{children}</LayoutClient>
        </Providers>
      </body>
    </html>
  );
}