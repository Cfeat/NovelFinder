import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾页 · 从喜欢的小说，发现下一本",
  description: "添加你喜欢的小说，发现适合自己的下一本。每一条推荐，都有具体的理由。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}

