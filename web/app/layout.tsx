import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthNavControls } from "@/components/auth/AuthNavControls";
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
  title: "Belgian Bridge Competition",
  description: "Belgian bridge team competition platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <a href="/" className="text-sm font-semibold">
              Belgian Bridge
            </a>
            <AuthNavControls />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
