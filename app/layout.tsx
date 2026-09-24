import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bill OCR",
  description: "Upload a bill, extract its details.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}