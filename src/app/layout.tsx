import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Timelapse",
    template: "%s · Timelapse",
  },
  description: "Browser-first study verification with sparse capture timelapses.",
  applicationName: "Timelapse",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/app-icon.svg",
    apple: "/icons/app-icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Timelapse",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
