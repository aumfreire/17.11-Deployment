import type { Metadata } from "next";
import { Manrope, Merriweather } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Shop — IS 455 Ch.17",
  description: "Operational shop UI for customer ops, ordering, and warehouse scoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${merriweather.variable} antialiased`}>
        <Nav />
        <main className="main-shell">{children}</main>
      </body>
    </html>
  );
}
