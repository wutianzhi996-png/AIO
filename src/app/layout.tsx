import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "启明星学习平台",
  description: "AI驱动的个人学习管理平台，助力实现学习目标",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased font-sans"
      >
        {children}
      </body>
    </html>
  );
}
