import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.arkout.in"),
  title: {
    default: "Arkout — Campus printing, simplified",
    template: "%s — Arkout",
  },
  description:
    "A more considered campus printing experience. Connect to a kiosk, upload your document, review print options, and complete checkout.",
  applicationName: "Arkout",
  keywords: ["campus printing", "self-service printing", "college print kiosk", "Arkout PrintPod"],
  openGraph: {
    title: "Arkout — Campus printing, simplified",
    description: "From your screen to the page, Arkout makes campus printing feel simpler.",
    url: "https://www.arkout.in",
    siteName: "Arkout",
    locale: "en_IN",
    type: "website",
    images: ["/arkout-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arkout — Campus printing, simplified",
    description: "A more considered campus printing experience.",
    images: ["/arkout-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.variable + " " + geistMono.variable + " h-full antialiased"}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
