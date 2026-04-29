import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SubscriptionGate from "@/components/SubscriptionGate";
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
  title: "TrueAngle",
  description: "Estimating and budgeting for tradesmen, built by tradesmen.",
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
    >
      <body className="min-h-full bg-slate-100 text-slate-950">
        <SubscriptionGate>{children}</SubscriptionGate>
      </body>
    </html>
  );
}