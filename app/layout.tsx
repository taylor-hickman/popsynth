import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pop Synth",
  description: "A synthetic data generator for pop-culture-inspired themes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
