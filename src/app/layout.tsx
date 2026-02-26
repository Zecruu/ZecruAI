import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ElectronUpdateBanner from "@/components/ElectronUpdateBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZecruAI",
  description: "Your AI agent — simple for everyone, powerful for developers.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZecruAI",
  },
  metadataBase: new URL("https://www.zecruai.com"),
  openGraph: {
    title: "ZecruAI",
    description: "Your AI agent — simple for everyone, powerful for developers.",
    url: "https://www.zecruai.com",
    siteName: "ZecruAI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ZecruAI",
    description: "Your AI agent — simple for everyone, powerful for developers.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ElectronUpdateBanner />
        {children}
      </body>
    </html>
  );
}
