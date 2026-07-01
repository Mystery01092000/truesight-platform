import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Body workhorse — quiet, neutral, highly readable.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display voice — a sharp technical grotesk for headings, the wordmark and
// hero numerals. This is the character face; it carries the Argus identity.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Instrument face — every piece of machine data (URNs, IDs, counts, regions,
// metrics) is set in mono, so the product reads like a console for the estate.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
  weight: ["400", "500", "600"],
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
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
