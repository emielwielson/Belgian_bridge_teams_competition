import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { AuthNavControls } from "@/components/auth/AuthNavControls";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");

  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("nav");

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="border-b border-zinc-200 bg-white shadow-sm">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="text-sm font-semibold text-zinc-900">
                {t("brand")}
              </Link>
              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <AuthNavControls />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col text-zinc-900">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
