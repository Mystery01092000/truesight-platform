import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Argus — Cloud governance with no blind spots",
    template: "%s · Argus",
  },
  description:
    "The enterprise IaaS experience layer across DevOps. One visual, self-discovering pane across AWS, Azure, GitHub, Terraform, cost and security.",
  applicationName: "Argus",
  authors: [{ name: "Rishabh Arya" }],
  metadataBase: new URL("https://argus-infraspace.centricitywealth.tech"),
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
