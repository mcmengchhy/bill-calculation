import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PartySplit Time-Sync — Fair Party Bill & Invoice Calculator",
  description:
    "Divide party bills equally by Time In and Time Out duration, with special Free Payments and VIP Free Pass support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
