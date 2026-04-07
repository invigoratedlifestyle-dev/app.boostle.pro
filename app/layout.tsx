import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boostle Support",
  description:
    "Contact Boostle support for installation help, billing questions, troubleshooting, and app assistance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}