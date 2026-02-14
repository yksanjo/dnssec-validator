import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DNSSEC Validator",
  description: "Verify DNSSEC configuration for domains",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
